const express = require('express')
const app = express()
const expressLayouts = require('express-ejs-layouts')
const Indexrouter  = require('./routes/index')
const Roomrouter  = require('./routes/room')
const viewbookrouter  = require('./routes/viewbook/viewbook')
const Authrouter  = require('./routes/authcontroller')
const dashboardrouter  = require('./routes/dashboard/dashboard')
const {requireauth,checkuser} = require("./middleware/authmiddleware")
const dotenv = require('dotenv');
const mongoose = require("mongoose")
const cookieparser = require("cookie-parser")
const methodoverride = require('method-override')
const passport = require('passport');
const session = require('express-session');
const socket = require('socket.io')
const bodyParser = require('body-parser')

dotenv.config({
	path:"./config/.env"
})

require('./config/passport-setup')(passport);

//encrypting Cookies
app.use(session({
    secret:"keyboard cat",
    resave:false,
    saveUninitialized:false
}))

// creating session using cookies
app.use(passport.initialize());
app.use(passport.session());

//setting view engine as ejs
app.set('view engine','ejs')
app.set('views',__dirname+'/views')

//using express-ejs-layouts
app.set('layout','layouts/layout')
app.use(expressLayouts)

//setting public for static files
app.use(express.static('public'))

//other middlewares
app.use(methodoverride('_method'))
app.use(bodyParser.json({ limit: "50mb" }))
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true, parameterLimit: 50000 }))
app.use(cookieparser())
app.use("*",checkuser)

//connect to db
const connectDB = require('./config/db');
connectDB();


//setting up routers
app.use('/',Indexrouter)
app.use('/dashboard',dashboardrouter)
app.use('/auth', require('./routes/auth'));
app.use('/room',Roomrouter)
app.use('/viewbook',viewbookrouter);
app.use(Authrouter)


//starting the app
let server  = app.listen(process.env.PORT || 4000,(err)=>{
    if(err)console.log(err)
    else console.log('app has started')
})


var io = socket(server)
let message = new Map()

io.use(async (socket,next)=>{
	try {
		socket.bookid = socket.handshake.query.bookid
		socket.userid = socket.handshake.query.userid
		next()
	} catch (error) {
		console.log(error)
	}
})


io.sockets.on('connection',(socket)=>{
    console.log("socket is connected " + socket.id)
    socket.on('disconnect',()=>{
        io.to(socket.bookid).emit("removeuser",socket.userid)
    })
    socket.on("join",(data)=>{
        socket.join(socket.bookid)
        if(message[socket.bookid]){
            for(let i=0;i<message[socket.bookid].length;i++){
                io.emit('chatMessage',{msg : message[socket.bookid][i].msg,user : message[socket.bookid][i].user})
            }
        }else{
            message[socket.bookid] = []
        }
        if(data.hassub){
            console.log('user has connected with us')
            io.to(socket.bookid).emit("chatMessage",{msg :  `${socket.userid} has joined the chat`,user : ""})
        }
    })
    socket.on("adduser",(user)=>{
        io.to(socket.bookid).emit("adduser",user)
    })
    socket.on("removeuser",(user)=>{
        io.to(socket.bookid).emit("removeuser",user)
    })
    socket.on("chatMessage",(data)=>{
        message[socket.bookid].push({msg : data.msg,user : data.user})
        io.to(socket.bookid).emit("chatMessage",data)
        console.log(data.msg,data.user)
    })
})