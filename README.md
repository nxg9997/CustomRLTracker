# Custom Rocket League Tracker

1. Description
   This is the Custom Rocket League Tracker, a Node.js web application used to track player stats. It was originally created to track player stats for the RIT Esports Rocket League Team, but it can be adapted to fit any other team. It does not have access to the official Rocket League API, so instead stats are tracked by uploading replays to ballchasing.com, then retriving the stats from ballchasing.com in the form of a .csv file. Data is then parsed and stored as a JSON file. The application will most likely be updated to utilize SQL databases in the future to improve reliability.

2. File Formatting
  1. clips.json
     {"0":["GIF-YOUR-GAME-ID"]}

  2. players.json
     {"0":["STEAMID64"]}

  3. replays.json
     {"0":["BALLCHASING.COM-REPLAYID"]}

  4. stats.json
     {"0":[{"id":"STEAMID64","name":"PLAYERNAME","goals":0,"assists":0,"saves":0,"shots":0,"demos":0,"demoed":0,"games":0,"division":0,"defense_time":0,"neutral_time":0,"offense_time":0}]}

3. Server API
   1. GET
     * ../chase
        A simple handshake with the ballchasing.com api; confirms that the api key is valid.

     * ../test
        Returns the following player data: steamID64, username, link to rocketleague.tracker.network profile. (name of the endpoint was never changed, oops)

     * ../stats
        Returns all player stats.

     * ../clips
        Returns all the gif your game clip IDs.

   2. POST
     * ../admin
        Adds a new player to the application.

     * ../ball
        Uploads a new replay to ballchasing.com and retrieves the resulting data.

     * ../update
        Updates/changes player data. Has support for including multiple users and multiple stats, but the current application only can send a single user and a single stat change at a time.

     * ../steal
        Retrieves data from a ballchaser.com replayID.

     * ../clips
        Adds a new gif your game clip ID.

   3. DELETE
     * ../admin
        Removes a player based on their steamID64.

4. Notes
   * Any images currently in the repository are owned by RIT Esports, and are not to be used in personal applications. Please replace any images with your own if you choose to use this source code for your own project.

   * This application is still under development, so changes will occur often.

   * Some of the server-side code is written to comply with Heroku web hosting, so you may have to edit some sections of server.js to work with your web host.