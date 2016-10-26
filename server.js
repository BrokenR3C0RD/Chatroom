/*
	Chat Room
	By BrokenR3C0RD
*/

const VERSION  = "10.0.0-dev";



var ws         = require("ws");
var Type       = require("js-binary").Type;
var bcrypt     = require("bcryptjs");
var fs         = require("fs");
var express    = require("express");
var bodyParser = require("body-parser");
var morgan     = require("morgan");

var re   = /[a-zA-Z][a-zA-Z0-9_-]{4,19}/;
var hash = /[0-9A-F]{64}/i;

var db;

var database = new Type({
	users: [{
		username:    "string",
		joined:      "date",
		powers:      ["uint"],
		password:    "string",
		bannedUntil: "date"
	}]
});

try {
	db = database.decode(fs.readFileSync("users.db"));
} catch(e){
	db = {
		users: []
	};
	fs.writeFileSync("users.db", database.encode(db))
}

var getUserByName = function(username){
	var ret = null;
	db["users"].forEach(user => {
		if(user.username === username)
			ret = user;
	});
	return user;
}

var app = express();

app.set("view engine", "pug");

app.use(morgan("dev"));
app.use("/", express.static("public"));
app.post("/register", bodyParser.urlencoded({
	extended: true
}), (req, res, next) => {
	var form = req.form;
	
	if(typeof form.username !== "string" || !re.test(form.username))
		return res.renderFile("register.pug", {
			success: false,
			reason: "Whoops, your username is invalid! Usernames can only contain alphanumeric characters, _ and -, and must start with a letter."
		});
	
	if(typeof form.password !== "string" || !hash.test(form.password))
		return res.renderFile("register.pug", {
			success: false,
			reason: "The password sent doesn't seem to be a SHA-256 hash."
		});
	
	if(getUserByName(form.username) != null)
		return res.renderFile("register.pug", {
			success: false,
			reason: "This user already exists! Please choose a different one."
		});
		
	bcrypt.hash(form.password, 8, (err, hash) => {
		if(err)
			return res.renderFile("resgister.pug", {
				success: false,
				reason: "There was an error in the backend!"
			});
		
		db["users"].push({
			username: form.username,
			password: hash,
			joined: new Date(),
			powers: [],
			bannedUntil: new Date()
		});
		
		fs.writeFile("users.db", database.encode(db), function(err){
			res.renderFile("register.pug", {
				success: true,
				username: form.username
			});
			console.log("New user: " + form.username);
		});
	});
});

app.listen(8080);

var server = new ws.Server({
	port: 45695
});

var connections = [];
var userlist = [];
var socketByName = {};

server.on("connection", socket => {
	var user = null;

	socket.on("message", (data) => {
		var msg = tryParse(data);
		if(msg == null)
			return;
		
		switch(msg.type){
			case "login":
				if(msg.username == null)
					socket.close();
				
				if(user != null)
					return;
				
				if(typeof msg.username !== "string" || !re.test(msg.username))
					return socket.send(JSON.stringify({
						type: "response",
						from: "login",
						success: false,
						reason: "Invalid username. Please try again."
					}));
				
				if(typeof msg.hash !== "string" || !hash.test(msg.hash))
					return socket.send(JSON.stringify({
						type: "response",
						from: "login",
						success: false,
						reason: "Invalid password. Please check your client side implementation."
					}));
				
				var tmpUser = db.users[msg.username];
				if(tmpUser == null)
					return socket.send(JSON.stringify({
						type: "response",
						from: "login",
						success: false,
						reason: "This user doesn't exist! Please sign up first."
					}));
			
				
				bcrypt.compare(msg.hash, tmpUser.password, (err, res) => {
					if(!res)
						return socket.send(JSON.stringify({
							type: "response",
							from: "login",
							success: false,
							reason: "Your password is incorrect. Please try again."
						}));
					
					user = tmpUser;
					
					socket.send(JSON.stringify({
						type: "response",
						from: "login",
						success: true,
						reason: null
					}));
					
					socket.send(JSON.stringify({
						type: "system",
						message: "Welcome to Chat-R v" + VERSION + "."
					}));
					
					broadcast({
						type: "system",
						message: user.username + " has joined the chat."
					});
					
					userlist.push(user);
					connections.push(socket);
					socketByName[user.username] = socket;
				});
			
			case "message":
				if(user == null)
					return;
				
				var messsage = msg.message.trim();
				
				if(message.length == 0)
					return;
				
				broadcast({
					type: "message",
					user: user,
					message: message
				});
		}
	});
	
	socket.on("error", function(err){
		try {
			socket.close()
		} catch(e){
			return;
		}
	});
	
	socket.on("close", function(){
		if(user != null){
			userlist.splice(userlist.indexOf(user), 1);
			delete userByName[user.username];
			connections.splice(connections.indexOf(socket), 1);
			broadcast({
				type: "system",
				message: user.username + " has left the chat."
			});
		}
	});
});

var tryParse = function(data){
	try {
		return JSON.parse(data.toString());
	} catch(e){
		return null;
	}
};

var broadcast = function(message){
	connections.forEach(conn => {
		socket.send(JSON.stringify(message));
	});
};
