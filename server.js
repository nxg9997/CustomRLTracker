"use strict";

//Load node modules
const https = require("https");
let fs = require('fs');
const hostname = '127.0.0.1'; // - goes unused, not sure why this was included
const port = process.env.PORT || 3000; // gets the port from heroku, or defaults to port 3000
let express =  require('express');
let parser = require('body-parser');
let FormData = require('form-data');
let multer = require('multer');
let upload = multer();
const axios = require('axios');
let Request = require('request');

//get config information from config.js
let config = require("./config");

//set config data to local variables to save time editing code
const steamKey = config.getConfig().steamKey;
const ballchasingKey = config.getConfig().ballchasingKey;
const password = config.getConfig().password;

//create express app
let app = express();
app.use(parser.urlencoded({ extended: true }));
app.use(parser.json({type:'application/json'}));
app.use(upload.single('myFile'));
app.use(express['static'](__dirname));

//handshake with the ballchasing api, used to test api key, not used in the main application
app.get('/chase', function(req,res){
    https.get({host:'ballchasing.com',path:'/api/',headers:{Authorization: ballchasingKey}},(res2)=>{
        //console.log(res2);
        let data;
        res2.on('data',(chunk)=>{
            data = chunk;
        });
        res2.on('end', ()=>{
            //console.log(data);
            res.send(data);
        });
    });
});


//grabs steam data for all players
app.get('/test', function(req,res){
    let result = [];
    let players;
    fs.readFile('./players.json', (err,data) => {
        players = JSON.parse(data.toString());
        //console.log(players);
        //res.send({result: JSON.parse(data.toString())});
        let i = 0;
        for(let p of players["0"]){
            //console.log(i++);
            // grab the recent playtimes of all the players
            https.get(`https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v0001/?key=${steamKey}&steamid=${p}&format=json`, (res2) => {
                let data = "";
                res2.on('data', (chunk) => {
                    data += chunk;
                });
                res2.on('end', () => {
                    // grab the usernames (in addition to all the other juicy steam data) of all the players
                    https.get(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${steamKey}&steamids=${p}`, (res3) => {
                        let data2 = "";
                        res3.on('data', (chunk2) => {
                            data2 += chunk2;
                        });
                        res3.on('end', () => {
                            let obj = {};
                            //try{
                            // package player up into an object, add the player object to the result
                            obj = {
                                user: JSON.parse(data2),
                                recent: JSON.parse(data),
                                stats: `https://rocketleague.tracker.network/profile/steam/${p}`
                            };
                            /*}
                            catch(exc){console.log(exc);}*/
                            //res.send(obj);
                            result.push(obj);
                            // if the result length equals the number of players, send the result back to the application
                            if(result.length == players["0"].length){
                                res.send({result: result});
                            }
                        });
                    }).on('error', (err2) => {
                        res.send({result: 'error'});
                    });
                    
                });
            }).on('error', (err) => {
                res.send({result: 'error'});
            });
        }
    });
});

//adds a new player to the application, requires the password from config
app.post('/admin', (req,res) => {
    let dataIn = req.body;
    let currPlayers = null;
    //console.log(dataIn);
    if(dataIn["access"] != password){
        res.status(403).send({result:"forbidden"});
    }
    else{
        fs.readFile('./players.json', (err,data) => {
            currPlayers = JSON.parse(data.toString());
            if(currPlayers != null){
                currPlayers["0"].push(dataIn["0"]);
            }
            fs.writeFile('./players.json',JSON.stringify(currPlayers), (err) => {
                if(err)res.status(500).send({result:"error writing players.json"});
            });

            //update stats.json
            fs.readFile('./stats.json',(err,data)=>{
                let stats = JSON.parse(data.toString());

                //find new players
                let newPlayers = [];
                for(let id of currPlayers["0"]){
                    let isNew = true;
                    for(let stat of stats["0"]){
                        if(id == stat["id"]){
                            isNew = false;
                            break;
                        }
                    }
                    if(isNew){
                        newPlayers.push(id);
                    }
                }

                //add new players to stats.json
                let count = 0;
                for(let p of newPlayers){
                    let steamData = null;//await steamFetch(p);
                    Request(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${steamKey}&steamids=${p}`,(err,res,body)=>{
                        if(err) {/*console.log(err);*/return;}
                        steamData = JSON.parse(body);
                        let obj = {
                            id: p,
                            name: steamData["response"]["players"]["0"]["personaname"],
                            goals:0,
                            assists:0,
                            saves:0,
                            shots:0,
                            demos:0,
                            demoed:0,
                            games:0,
                            division:0,
                            defense_time:0,
                            neutral_time:0,
                            offense_time:0
                        }
                        stats["0"].push(obj);
                        count++;

                        if(count == newPlayers.length)
                        {
                            fs.writeFile('./stats.json', JSON.stringify(stats),(err)=>{
                                if(err){
                                    //console.log(err);
                                }
                            });
                        }
                    });
                    
                }
                
            });

            res.send(currPlayers);
        });
        
    }
    
});

//some error occured with this, it goes unused anyway
function steamFetch(id){
    return new Promise((resolve,reject)=>{
        Request(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${steamKey}&steamids=${id}`,(err,res,body)=>{
            if(err) reject(err);
            resolve(body);
        });
    });
}

//uploads a replay file to ballchasing.com
app.post('/ball', (req,res)=>{
    let dataIn = req.body;
    //let f = new FormData(dataIn);
    //console.log(req.file.originalname);

    // saves the uploaded replay file from the application locally (temporarily)
    fs.writeFile('./temp/' + req.file.originalname,req.file.buffer,(err)=>{
        if(err){
            //console.log(err);
            return;
        }

        let post = Request.post('https://ballchasing.com/api/v2/upload', (err,resp,body)=>{
            if(err){
                //console.log(err);
                res.send(err);
            }
            else{
                //console.log(body);
                let b = JSON.parse(body);

                stealStats(b["id"]);

                res.send(body);
            }

            // deletes the temporary file after the upload to ballchasing is finished
            fs.unlink('./temp/' + req.file.originalname,(err)=>{
                //console.log(err);
            });

            
        });

        post.setHeader('Authorization', ballchasingKey);

        let form = post.form();
        form.append('file',fs.createReadStream('./temp/' + req.file.originalname));
    });
});

// allows the data to be updated/changed for any player, requires password
app.post('/update', (req,res)=>{
    let dataIn = req.body;
    //console.log(dataIn);
    if(dataIn["1"] != password){
        res.send("forbidden");
        return;
    }
    fs.readFile('./stats.json',(err,data)=>{
        let stats = JSON.parse(data.toString());
        for(let x of dataIn["0"]){
            //console.log(x["id"]);
            for(let y of stats["0"]){
                //console.log(y["id"]);
                if(x["id"] == y["id"]){
                    //console.log("match");
                    if(x["type"] == "change"){
                        //console.log(y[x["stat"]]);
                        y[x["stat"]] = x["value"];
                    }
                    else if(x["type"] == "add"){
                        y[x["stat"]] += x["value"];
                    }
                    break;
                }
            }
        }
        fs.writeFile('./stats.json', JSON.stringify(stats), (err)=>{
            if(err){/*console.log(err);*/}
            res.send("done");
        });
    });
    
});

// removes a player from the app, requires password
app.delete('/admin', (req,res) => {
    let dataIn = req.body;
    let currPlayers = null;
    //console.log(dataIn);
    if(dataIn["access"] != password){
        res.status(403).send({result:"forbidden"});
    }
    else{
        fs.readFile('./players.json', (err,data) => {
            if(err){/*console.log(err);*/return;}
            currPlayers = JSON.parse(data.toString());
            if(currPlayers != null){
                for(let i = 0; i < currPlayers["0"].length; i++){
                    if(currPlayers["0"][i] == dataIn["0"]){
                        currPlayers["0"].splice(i,1);
                        break;
                    }
                }
                
            }
            fs.writeFile('./players.json',JSON.stringify(currPlayers), (err) => {
                if(err)res.status(500).send({result:"error writing players.json"});
            });
            res.send(currPlayers);
        });

        fs.readFile('./stats.json',(err,data)=>{
            if(err){/*console.log(err);*/return;}
            let stats = JSON.parse(data.toString());
            for(let i = 0; i < stats["0"].length; i++){
                if(stats["0"][i]["id"] == dataIn["0"]){
                    stats["0"].splice(i,1);
                    break;
                }
            }
            fs.writeFile('./stats.json',JSON.stringify(stats),(err)=>{
                if(err){/*console.log(err);*/}
            });
        });
        
    }
});

// update to allow user to send an ID to steal from
app.post('/steal',(req,res)=>{
    let dataIn = req.body;
    stealStats(dataIn['0']);//stealStats('642be93c-5f97-4592-8da5-189f85a0a352');
    res.send({"res":"done :)"});
});

//grab stats from ballchasers based on the given replay id (arrives as a csv)
function stealStats(id){
    fs.readFile('./replays.json',(err,data)=>{
        if(err){/*console.log(err);*/return;}
        let replays = JSON.parse(data.toString());
        for(let r of replays["0"]){
            if(id == r){
                //console.log("replay is a duplicate");
                return;
            }
        }
        replays["0"].push(id);
        fs.writeFile('./replays.json',JSON.stringify(replays),(err)=>{
            if(err){/*console.log(err);*/return;}
            doSteal();
        });
    });

    function doSteal(){
        let toFile = fs.createWriteStream('./temp/' + `${id}-players.csv`);
        Request(`https://ballchasing.com/dl/stats/players/${id}/${id}-players.csv`).pipe(toFile).on('close', () => {
            
            //console.log('done stealing data :) from: ' + `https://ballchasing.com/dl/stats/players/${id}/${id}-players.csv`);

            fs.readFile('./temp/' + `${id}-players.csv`,(err,data)=>{
                if(err){
                    //console.log(err);
                    return;
                }
                else{
                    if(data.toString().includes('DOCTYPE html')){
                        //console.log('bad file, link redirected :(');
                        //return;
                    }
                    else{
                        //replace all semicolons with commas like a csv is supposed to have :////// (nvm doesnt really matter lol)
                        let stringyData = data.toString();
                        //stringyData = stringyData.replace(/;/g,",");
                        //console.log(stringyData);

                        let parsed = [];
                        let rows = stringyData.split('\n');
                        //console.log("row count: "+rows.length);
                        /*for(let r of rows[0].split(',')){
                            console.log(r);
                            //console.log('\n');
                        }*/
                        for(let i = 0; i < rows.length; i++){
                            parsed.push([]);
                        }
                        //console.log("parsed rows: " + parsed.length);
                        for(let i = 0; i < rows.length; i++){
                            let split = rows[i].split(';');
                            for(let j = 0; j < split.length; j++){
                                parsed[i].push(split[j]);
                                //console.log("parsed col: " + parsed[i].length);
                            }
                        }

                        //testing parsed data
                        for(let i = 0; i < parsed.length; i++){
                            let str = "";
                            for(let j = 0; j < parsed[i].length; j++){
                                str += parsed[i][j] + " | ";
                            }
                            //console.log(str);
                        }

                        fs.readFile('./stats.json', (err,data)=>{
                            if(err){
                                //console.log(err);
                                return;
                            }
                            let stats = JSON.parse(data.toString());
                            for(let i = 1; i < parsed.length; i++){
                                for(let s of stats["0"]){
                                    if(parsed[i][1] == s["name"]){
                                        s["goals"] += parseInt(parsed[i][5]);
                                        s["assists"] += parseInt(parsed[i][6]);
                                        s["saves"] += parseInt(parsed[i][7]);
                                        s["shots"] += parseInt(parsed[i][8]);
                                        s["demos"] += parseInt(parsed[i][43]);
                                        s["demoed"] += parseInt(parsed[i][44]);
                                        s["games"] ++;
                                        s["defense_time"] += parseFloat(parsed[i][40]);
                                        s["neutral_time"] += parseFloat(parsed[i][41]);
                                        s["offense_time"] += parseFloat(parsed[i][42]);
                                    }
                                }
                            }
                            fs.writeFile('./stats.json',JSON.stringify(stats),(err)=>{
                                if(err){
                                   // console.log(err);
                                }
                            });
                            
                        });
                        
                        
                    }
                    fs.unlink('./temp/' + `${id}-players.csv`,(err)=>{
                        if(err){/*console.log(err);*/}
                    });
                }
            })
        });
    }
}

//removes all files from the temp folder
function cleanTemp(){
    fs.readdir('./temp',(err,files)=>{
        files.forEach(file => {
            //fs.unlink(file)
            //console.log(file);
        });
    });
}

//sends all player stats to the application
app.get('/stats',(req,res)=>{
    fs.readFile('./stats.json',(err,data)=>{
        if(err){
            res.send({"res":"err"});
            return;
        }
        let stats = JSON.parse(data.toString());
        res.send(stats);
    });
});

//sends the gif your game IDs to the app
app.get('/clips',(req,res)=>{
    fs.readFile('./clips.json',(err,data)=>{
        if(err){
            res.send({"res":"err"});
            return;
        }
        let clips = JSON.parse(data.toString());
        res.send(clips);
    });
});

//adds a new clip ID
app.post('/clips', (req,res)=>{
    let dataIn = req.body;
    //console.log(dataIn);
    if(dataIn["1"] != password){
        res.send("forbidden");
        return;
    }
    fs.readFile('./clips.json',(err,data)=>{
        let clips = JSON.parse(data.toString());
        clips["0"].push(dataIn["0"]);
        fs.writeFile('./clips.json', JSON.stringify(clips), (err)=>{
            if(err){/*console.log(err);*/}
            res.send("done");
        });
    });
    
});

//start server
app.listen(port);
//console.log(`Server started on port ${port}`);