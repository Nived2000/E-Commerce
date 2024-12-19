const User = require('../model/userModel')

const checkSession = (req, res, next)=>{
    if(req.session.user){
        next()
    }else{
        res.redirect('/user/login')
    }
}

const isLogin = (req, res, next)=>{
    if(req.session.user){
        res.redirect('/user/home')
    }else{
        next()
    }
}

const isLoginAdmin = (req, res, next)=>{
    if(req.session.admin){
        res.redirect('/admin/dashboard')
    }else{
        next();
    }
}

const checkSessionAdmin = (req, res, next)=>{
    if(req.session.admin){
        next()
    }else{
        res.redirect('/admin/login')
    }
}


module.exports = {checkSession, isLogin, checkSessionAdmin, isLoginAdmin}