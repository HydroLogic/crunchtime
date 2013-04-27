/**
 * Module dependencies.
 */
var express = require('express')
    //, mongoose = require('mongoose')
    , routes = require('./routes')
    //, middleware = require('./middleware')
    //, request = require('request')
    //, timemap = require('./timemap')
    , passport = require('passport')
    , OpenStreetMapStrategy = require('passport-openstreetmap').Strategy
    ;

var redis;

var OPENSTREETMAP_CONSUMER_KEY = process.env.OSM_CONSUMER_KEY || "--insert-openstreetmap-consumer-key-here--";
var OPENSTREETMAP_CONSUMER_SECRET = process.env.OSM_CONSUMER_SECRET || "--insert-openstreetmap-consumer-secret-here--";

var init = exports.init = function (config) {
  
  //var db_uri = process.env.MONGOLAB_URI || process.env.MONGODB_URI || config.default_db_uri;
  //mongoose.connect(db_uri);
  
  if (process.env.REDISTOGO_URL) {
    console.log("p1");
    var rtg = require("url").parse(process.env.REDISTOGO_URL);
    console.log("p2");
    redis = require("redis").createClient(rtg.port, rtg.hostname);
    console.log("p3");
    redis.auth(rtg.auth.split(":")[1]);
  }

  var app = express.createServer();

  app.configure(function(){
    app.set('views', __dirname + '/views');
    app.set('view engine', 'jade');
    app.set('view options', { pretty: true });

    app.use(express.bodyParser());
    app.use(express.cookieParser());
    app.use(express.methodOverride());
    app.use(express.static(__dirname + '/public'));
    app.use(app.router);
    app.use(passport.initialize());
    app.use(passport.session());
  });

  app.configure('development', function(){
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
  });

  app.configure('production', function(){
    app.use(express.errorHandler({ dumpExceptions: true, showStack: false}));
  });
  
  // Routes
  app.get('/', function(req, res){
    res.render('homepage', { json: "" });
  });
  
  app.post('/map', function(req, res){
    //var tm = new timemap.TimeMap({
    //  json: req.body.json
    //});
    //tm.save(function(err){
    //  res.send({ outcome: ( err || tm._id ) });
    //});
    var specialkey = Math.round( Math.random() * 1000000000 ) + "";
    redis.set(specialkey, req.body.json);
    res.send({ outcome: specialkey });
  });

  app.get('/map/:byid', function(req, res){
    //timemap.TimeMap.findById(req.params.byid, function(err, map){
    //  res.render('homepage', { json: map.json });
    //});
    redis.get(req.params.byid, function(err, reply){
      if(err){
        return res.send(err);
      }
      res.render('homepage', { json: reply });
    });
  });
  
  ensureAuthenticated = function(req, res, next) {
    if (req.isAuthenticated()) { return next(); }
    res.redirect('/login')
  };
  
  app.get('/login', function(req, res){
    res.render('login', { user: req.user });
  });
  app.get('/account', ensureAuthenticated, function(req, res){
    res.render('account', { user: req.user });
  });
  app.get('/auth/openstreetmap', passport.authenticate('openstreetmap'), function(req, res){
    res.send('hello 1');
  });
  app.get('/auth/openstreetmap/callback', passport.authenticate('openstreetmap', { failureRedirect: '/login' }), function(req, res) {
    res.send('hello 2');
  });

  app.get('/auth/openstreetmap/callback', passport.authenticate('openstreetmap', { failureRedirect: '/login' }), function(req, res) {
    res.redirect('/');
  });
  
  var replaceAll = function(src, oldr, newr){
    while(src.indexOf(oldr) > -1){
      src = src.replace(oldr, newr);
    }
    return src;
  };

  //app.get('/auth', middleware.require_auth_browser, routes.index);
  //app.post('/auth/add_comment',middleware.require_auth_browser, routes.add_comment);
  
  // redirect all non-existent URLs to doesnotexist
  app.get('*', function onNonexistentURL(req,res) {
    res.render('doesnotexist',404);
  });

  return app;
};


passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});

passport.use(new OpenStreetMapStrategy({
    consumerKey: OPENSTREETMAP_CONSUMER_KEY,
    consumerSecret: OPENSTREETMAP_CONSUMER_SECRET
  },
  function(token, tokenSecret, profile, done) {
    // asynchronous verification, for effect...
    process.nextTick(function () {
      
      // To keep the example simple, the user's OpenStreetMap profile is returned to
      // represent the logged-in user.  In a typical application, you would want
      // to associate the OpenStreetMap account with a user record in your database,
      // and return that user instead.
      return done(null, profile);
    });
  }
));




// Don't run if require()'d
if (!module.parent) {
  var config = require('./config');
  var app = init(config);
  app.listen(process.env.PORT || 3000);
  //console.info("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
}