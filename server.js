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
let mysql = require('mysql');

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

// update to allow user to send an ID to steal from
app.post('/steal',(req,res)=>{
    let dataIn = req.body;
    stealStats(dataIn['0']);//stealStats('642be93c-5f97-4592-8da5-189f85a0a352');
    res.send({"res":"done :)"});
});

//grab stats from ballchasers based on the given replay id (arrives as a csv)
function stealStats(id){

    let conn = mysql.createConnection(process.env.JAWSDB_URL);

    conn.connect();

    conn.query(`insert into replays (id) values(?)`,
    [
        id
    ],
    (err,res,fields)=>{
        if(err){
            //console.log(err);
            return;
        }
        else{
            //console.log(res);
            doSteal();
        }
    });

    //conn.end();

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
                        /*for(let i = 0; i < parsed.length; i++){
                            let str = "";
                            for(let j = 0; j < parsed[i].length; j++){
                                str += parsed[i][j] + " | ";
                            }
                            //console.log(str);
                        }*/

                        conn.query(`select * from stats`,(err,res,fields)=>{
                            if(err) return;
                            else{
                                let count = 0;
                                let completed = 0;
                                for(let i = 1; i < parsed.length; i++){
                                    for(let s of res){
                                        if(parsed[i][1] == s.name){
                                            count++;
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

                                            conn.query(`update stats set goals=?, assists=?, saves=?, shots=?, demos=?, demoed=?, games=?, defense_time=?, neutral_time=?, offense_time=? where steamid=?`,
                                            [
                                                s.goals,
                                                s.assists,
                                                s.saves,
                                                s.shots,
                                                s.demos,
                                                s.demoed,
                                                s.games,
                                                s.defense_time,
                                                s.neutral_time,
                                                s.offense_time,
                                                s.steamid
                                            ],
                                            (err,res,fields)=>{
                                                if(err){
                                                    //console.log(err);
                                                    return;
                                                }
                                                else{
                                                    completed++;
                                                    if(count == completed){
                                                        conn.end();
                                                    }
                                                    //console.log(s.name + " has been updated");
                                                }
                                            });
                                        }
                                    }
                                }
                            }
                        });

                        /*fs.readFile('./stats.json', (err,data)=>{
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
                            
                        });*/
                        
                        
                    }
                    fs.unlink('./temp/' + `${id}-players.csv`,(err)=>{
                        if(err){/*console.log(err);*/}
                    });
                }
            })
        });
    }
}

/// - database functions

//adds all json stats data into a pre-existing database
function initDB(){
    let conn = mysql.createConnection(process.env.JAWSDB_URL);

    conn.connect();

    fs.readFile('stats.json',(err,data)=>{
        if(err){
            //console.log(err);
            return;
        }
        else{
            let stats = JSON.parse(data.toString());

            for(let s of stats["0"]){
                conn.query(`insert into stats (steamid,name,goals,assists,saves,shots,demos,demoed,games,division,defense_time,offense_time,neutral_time) values ("${s['id']}","${s['name']}",${s['goals']},${s['assists']},${s['saves']},${s['shots']},${s['demos']},${s['demoed']},${s['games']},${s['division']},${s['defense_time']},${s['offense_time']},${s['neutral_time']})`, (err,res,fields) => {
                    if(err){
                        //console.log(err);
                        return;
                    }
                    else{
                        //console.log(res);
                    }
                });
            }

            conn.end();
        }
    });
}

// - grabs row data based on the given steamID64
function getDataDB(id){
    let result = null;

    let conn = mysql.createConnection(process.env.JAWSDB_URL);

    conn.connect();

    conn.query(`select * from stats where steamid=?`,
    [
        id
    ],
    (err,res,fields)=>{
        if(err){
            //console.log(err);
            return;
        }
        else{
            //console.log(res);
            result = res;
        }
    });

    conn.end();

    return result;
}

// - sends the stats of a specific player based on the received steamID64
app.post('/playerstats',(req,res)=>{
    //console.log(req.body);
    let conn = mysql.createConnection(process.env.JAWSDB_URL);

    conn.connect();

    conn.query(`select * from stats where steamid=?`,
    [
        req.body["0"]
    ],
    (err,res2,fields)=>{
        if(err){
            //console.log(err);
            return;
        }
        else{
            //console.log(res2);
            //result = res2;
            res.send(res2);
        }
    });

    conn.end();
});

// - gets all players in the database
app.get('/getdb', function(req,res){
    let result = null;

    let conn = mysql.createConnection(process.env.JAWSDB_URL);

    conn.connect();

    conn.query(`select * from stats`,(err,res2,fields)=>{
        if(err){
            //console.log(err);
            return;
        }
        else{
            //console.log(res2);
            result = res2;
            res.send(result);
        }
    });

    conn.end();

});

// - adds a new player based on their steamID64
app.post('/addplayerdb', function(req,res){
    if(req.body["1"] != password){
        res.send({result:'bad access code'});
        return;
    }
    let id = req.body["0"];
    //console.log(req.body);
    let conn = mysql.createConnection(process.env.JAWSDB_URL);

    https.get(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${steamKey}&steamids=${id}`, (res3) => {
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
                stats: `https://rocketleague.tracker.network/profile/steam/${id}`
            };
            /*}
            catch(exc){console.log(exc);}*/
            //res.send(obj);
            //result.push(obj);
            // if the result length equals the number of players, send the result back to the application
            /*if(result.length == players["0"].length){
                res.send({result: result});
            }*/

            conn.connect();

            conn.query(`insert into stats (steamid,name,goals,assists,saves,shots,demos,demoed,games,division,defense_time,offense_time,neutral_time) values (?,"${obj['user']["response"]["players"][0]["personaname"]}",0,0,0,0,0,0,0,0,0,0,0)`,
            [
                id
            ],
            (err,res2,fields)=>{
                if(err){
                    //console.log(err);
                    res.send({result:"fail"});
                    return;
                }
                else{
                    //console.log(res2);
                    /*result = res2;
                    res.send(result);*/
                    res.send({result:"success"});
                }
            });

            conn.end();
        });
    }).on('error', (err2) => {
        //res.send({result: 'error'});
    });

    

});

// - deletes a player from the database
app.delete('/deletedb', (req,res)=>{
    if(req.body["1"] != password){
        res.send({result:'bad access code'});
        return;
    }
    let conn = mysql.createConnection(process.env.JAWSDB_URL);
    conn.connect();
    conn.query(`delete from stats where steamid=?`,
    [
        req.body["0"]
    ],
    (err,res2,fields)=>{
        if(err){
            //console.log(err);
            res.send({result: 'error'});
            return;
        }
        else{
            res.send({result: 'success'});
        }
    });
    conn.end();
});

// - add a clip to the database
app.post('/clipdb',(req,res)=>{
    if(req.body["1"] != password){
        res.send({result:'bad access code'});
        return;
    }
    let conn = mysql.createConnection(process.env.JAWSDB_URL);
    conn.connect();
    conn.query(`insert into clips (id) values(?)`,
    [
        req.body["0"]
    ],(err,res2,fields)=>{
        if(err){
            //console.log(err);
            res.send({result: 'error'});
            return;
        }
        else{
            res.send({result: 'success'});
        }
    });
    conn.end();
});

// - remove a clip from the database
app.delete('/clipdb',(req,res)=>{
    if(req.body["1"] != password){
        res.send({result:'bad access code'});
        return;
    }
    let conn = mysql.createConnection(process.env.JAWSDB_URL);
    conn.connect();
    conn.query(`delete from clips where id=?`,
    [
        req.body["0"]
    ],
    (err,res2,fields)=>{
        if(err){
            //console.log(err);
            res.send({result: 'error'});
            return;
        }
        else{
            res.send({result: 'success'});
        }
    });
    conn.end();
});

// - get all the clips in the database
app.get('/clipdb',(req,res)=>{
    let conn = mysql.createConnection(process.env.JAWSDB_URL);
    conn.connect();
    conn.query(`select * from clips`,(err,res2,fields)=>{
        if(err){
            //console.log(err);
            res.send({result: 'error'});
            return;
        }
        else{
            res.send(JSON.stringify(res2));
        }
    });
    conn.end();
});

// - update player in the database
app.post('/updatedb',(req,res)=>{
    if(req.body["1"] != password){
        res.send({result:'bad access code'});
        return;
    }
    let error = '';
    let count = req.body["0"].length;
    let conn = mysql.createConnection(process.env.JAWSDB_URL);
    conn.connect();
    let num = 0;
    for(let p of req.body["0"]){
        let newVal;
        conn.query(`select * from stats where steamid=?`,
        [
            p["id"]
        ],
        (err,res2,fields)=>{
            if(err){
                //console.log(err);
                //res.send({result: 'error'});
                error = err;
                num++;
                if(num >= count){
                    finish();
                }
                return;
            }
            else{
                //console.log(res2);
                newVal = res2[0][p["stat"]];
                if(p["type"] == 'add'){
                    newVal += p["value"];
                }
                else if(p["type"] == 'change'){
                    newVal = p["value"];
                }
                conn.query(`update stats set ${p["stat"]} = ? where steamid=?`,
                [
                    //p["stat"],
                    newVal,
                    p["id"]
                ],
                (err,res2,fields)=>{
                    if(err){
                        //console.log(err);
                        //res.send({result: 'error'});
                        error = err;
                    }
                    else{
                        //res.send({result: 'success'});
                    }
                    num++;
                    if(num >= count){
                        finish();
                    }
                    //conn.end();
                });
            }
        });
        
    }
    //finish();
    function finish(){
        conn.end();
        res.send({result:"done",error:error});
    }

    
});

// - sends 'true' if the auth key is the same as the password
app.post('/auth',(req,res)=>{
    if(req.body['0'] === password){
        res.send({result:true});
    }
    else{
        res.send({result:false});
    }
});

// - get the playtimes for each player, and attach their steamID
app.get('/playtime',(req,res)=>{

    let conn = mysql.createConnection(process.env.JAWSDB_URL);
    conn.connect();
    conn.query(`select * from stats`,(err,res2,fields)=>{
        if(err){
            //console.log(err);
            res.send({result: 'error'});
            return;
        }
        else{
            //res.send(JSON.stringify(res2));
            let toSend = [];
            for(let p of res2){
                //console.log(i++);
                // grab the recent playtimes of all the players
                https.get(`https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v0001/?key=${steamKey}&steamid=${p.steamid}&format=json`, (res3) => {
                    let data = "";
                    res3.on('data', (chunk) => {
                        data += chunk;
                    });
                    res3.on('end', () => {
                        let obj = {
                            steamid: p.steamid,
                            recent: JSON.parse(data)
                        };
                        toSend.push(obj);
                        if(toSend.length == res2.length){
                            res.send(JSON.stringify(toSend));
                        }
                    });
                });
            }
        }
    });
    conn.end();

    
});

//initDB();
//getDataDB('76561198129260496');//test with whitebark's steamID

//start server
app.listen(port);
//console.log(`Server started on port ${port}`);