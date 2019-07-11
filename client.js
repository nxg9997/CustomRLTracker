"use strict";

function getData() {
    $.ajax({
        type: 'GET',
        url: document.URL + "test",
        success: function(res){
            //console.log(res);
            for(let p of res.result){
                let carball = null;
                let playtime = 0;
                try{
                    //console.log(p.user.response.players[0].personaname);
                    if(p.recent.response.games != null){
                        for(let g of p.recent.response.games){
                            if(g.name == "Rocket League"){
                                carball = g;
                                break;
                            }
                        }
                    }
                    playtime = carball.playtime_2weeks/60;
                }
                catch(err){}
                let obj = {
                    Player: p.user.response.players[0].personaname,
                    Playtime: Math.ceil(playtime*100)/100
                };
                if(playtime < 6){
                    obj._rowVariant = 'danger';
                }
                else if(playtime >= 6 && playtime <= 10){
                    obj._rowVariant = 'warning';
                }
                else{
                    obj._rowVariant = 'success'
                }
                app.tData.push(obj);
            }
            //console.log(app.tData);
            sortData();
            //console.log(app.tData);
        }
    });
};

function sortData(){
    function checkSorted(){
        for(let i = 1; i < app.tData.length; i++){
            if(app.tData[i].Playtime < app.tData[i-1].Playtime){
                return false;
            }
        }
        return true;
    }
    do{
        for(let i = 1; i < app.tData.length; i++){
            if(app.tData[i].Playtime < app.tData[i-1].Playtime){
                let temp0 = JSON.parse(JSON.stringify(app.tData[i-1]));
                let temp1 = JSON.parse(JSON.stringify(app.tData[i]));

                app.tData[i] = temp0;
                app.tData[i-1] = temp1;
            }
        }
    }
    while(!checkSorted());
}

function sendFile(){
    let f = document.querySelector('#replay');
    console.log(f.files);
    /*$.ajax({
        type: 'POST',
        url: document.URL + "ball",
        data: JSON.stringify({
            file: f.files[0]
        }),
        success: function(res){
            console.log(res);
        }
    });*/
    let form = new FormData();
    console.log(form);
    form.append('myFile',f.files[0]);
    //console.log(form.entries());
    fetch('/ball',{method:'POST',body:form}).then(res=>
        res.json()
    ).then((data)=>{
        console.log(data);
    });
}

function stealTest(){
    fetch('/steal',{method:'GET'});
}



/// https://html-online.com/articles/get-url-parameters-javascript/

function getUrlVars() {
    let vars = {};
    let parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m,key,value) {
        vars[key] = value;
    });
    return vars;
}

function getUrlParam(parameter, defaultvalue){
    let urlparameter = defaultvalue;
    if(window.location.href.indexOf(parameter) > -1){
        urlparameter = getUrlVars()[parameter];
    }
    return urlparameter;
}