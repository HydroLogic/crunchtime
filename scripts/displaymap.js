var DEBUG = false;
var firstfile = true;

var map, playStep;
var mytime = new Date();
var mintime = (new Date("January 1, 5000")) * 1;
var maxtime = (new Date("January 1, 100")) * 1;
var maxlat = -90;
var minlat = 90;
var maxlng = -180;
var minlng = 180;
var timelayers = [ ];

$(document).ready(function(){
  // make a Leaflet map
  map = new L.Map('map');
  map.attributionControl.setPrefix('');
  //L.control.pan().addTo(map);
  //L.control.zoom().addTo(map);
  var terrain = 'http://{s}.tile.stamen.com/terrain/{z}/{x}/{y}.png';
  var terrainAttrib = 'Map data &copy; 2013 OpenStreetMap contributors, Tiles by Stamen Design';
  terrainLayer = new L.TileLayer(terrain, {maxZoom: 17, attribution: terrainAttrib});
  map.addLayer(terrainLayer);
  map.setView(new L.LatLng(40.484037,-106.825046), 10);

  // set up the file drop
  document.body.addEventListener('dragenter', blockHandler, false);
  document.body.addEventListener('dragexit', blockHandler, false);
  document.body.addEventListener('dragover', blockHandler, false);
  document.body.addEventListener('drop', dropFile, false);

  // set up the jQuery timeline slider
  $("#slidebar").slider({
    orientation: "horizontal",
    range: "min",
    min: (new Date()) - 24 * 60 * 60 * 1000,
    max: (new Date()) * 1,
    value: 500,
    slide: function(event, ui){
      if(playStep){
        window.clearInterval(playStep);
        playStep = null;
      }
      displayTime(ui.value);
      geotimes(ui.value);
    }
  });
  
  // load default GeoJSON from Chicago
  $.getJSON('chicago.geojson', function(gj){
    L.geoJson(gj, { onEachFeature: jsonmap });
    map.fitBounds(new L.LatLngBounds(new L.LatLng(minlat, minlng), new L.LatLng(maxlat, maxlng)));
    updateTimeline();
  });
});

var displayTime = function(t){
  $("#readtime").text( (new Date(t)).toUTCString() );
};

var blockHandler = function(e){
  e.stopPropagation();
  e.preventDefault();
};

var dropFile = function(e){
  e.stopPropagation();
  e.preventDefault();

  var files = e.dataTransfer.files;
  if(files && files.length){
    if(firstfile){
      // remove default map
      for(var t=0;t<timelayers.length;t++){
        map.removeLayer(timelayers[t].geo);
      }
      timelayers = [ ];

      // reset defaults
      mintime = (new Date("January 1, 5000")) * 1;
      maxtime = (new Date("January 1, 100")) * 1;
      maxlat = -90;
      minlat = 90;
      maxlng = -180;
      minlng = 180;
    }
    firstfile = false;

    for(var i=0;i<files.length;i++){
      var reader = new FileReader();
      reader.onload = function(e){
        var injson;
        try{
          injson = $.parseJSON( e.target.result );
        }
        catch(err){
          // XML-based (assume KML)
          var placemarks = $.parseXML( e.target.result ).getElementsByTagName("Placemark");
          for(var i=0;i<placemarks.length;i++){
            var inkml = placemarks[i];
            var whens = inkml.getElementsByTagName("when");
            var coords = inkml.getElementsByTagName("coord");
            if(whens.length && !coords.length){
              coords = inkml.getElementsByTagName("gx:coord");
            }
            if(whens.length && coords.length && whens.length == coords.length){
              var movemarker = new L.marker( new L.LatLng(0, 0), { clickable: false } );
              for(var c=0;c<coords.length;c++){
                var rawcoord = $(coords[c]).text().split(" ");
                var mycoord = new L.LatLng( rawcoord[1], rawcoord[0] );

                maxlat = Math.max(maxlat, mycoord.lat);
                maxlng = Math.max(maxlng, mycoord.lng);
                minlat = Math.min(minlat, mycoord.lat);
                minlng = Math.min(minlng, mycoord.lng);              

                var mytime = new Date( $(whens[c]).text() );
                mintime = Math.min( mintime, mytime * 1 );
                maxtime = Math.max( maxtime, mytime * 1 );
              
                timelayers.push({
                  geo: movemarker,
                  ll: mycoord,
                  time: mytime
                });
              }
            }
            else{
              // check for <begin> and <end> tags
              var begin = inkml.getElementsByTagName("begin");
              var end = inkml.getElementsByTagName("end");
              if(begin.length || end.length){
                // KML placemark with a begin and/or end
                var timefeature = { };
                if(begin.length){
                  timefeature.start = new Date( $(begin[0]).text() );
                  mintime = Math.min(mintime, timefeature.start * 1);
                  maxtime = Math.max(maxtime, timefeature.start * 1);
                }
                if(end.length){
                  timefeature.end = new Date( $(end[0]).text() );
                  mintime = Math.min(mintime, timefeature.end * 1);
                  maxtime = Math.max(maxtime, timefeature.end * 1);
                }
                timefeature.geo = kmlmap(inkml);
                timelayers.push( timefeature );
              }
              else{
                // KML object without a time
                var maps = kmlmap(inkml);
                for(var m=0;m<maps.length;m++){
                  map.addLayer( maps[m] );
                }
              }
            }
            map.fitBounds(new L.LatLngBounds(new L.LatLng(minlat, minlng), new L.LatLng(maxlat, maxlng)));
            updateTimeline();
          }
          return;
        }
        L.geoJson(injson, {
          /* style: function(feature){ }, */
          onEachFeature: jsonmap
        });
        map.fitBounds(new L.LatLngBounds(new L.LatLng(minlat, minlng), new L.LatLng(maxlat, maxlng)));
        updateTimeline();
      };
      reader.readAsText(files[i]);
    }
  }
};

function updateTimeline(){
  if(maxtime > mintime && !firstfile){
    $(".instructions").css({ display: "none" });
    $(".output").css({ display: "block" });
  }
  $("#slidebar").slider({
    min: mintime,
    max: maxtime,
    value: mintime
  });
  displayTime(mintime);
  geotimes(mintime);
}

function geotimes(nowtime){
  var coordTime = null;
  var lastCoord = null;
  for(var t=0;t<timelayers.length;t++){
    if(typeof timelayers[t].ll != 'undefined'){
      // moving coordinate-time marker
      if(!coordTime || coordTime != timelayers[t].geo){
        // on the first coordinate-time pair read for a marker:

        if( coordTime && lastCoord ){
          // there was a marker before this marker, but it never read a time after the timeline
          // currently we drop these markers
          map.removeLayer( coordTime );
        }
        
        coordTime = timelayers[t].geo;
        if( nowtime < timelayers[t].time * 1 ){
          // first coordinate-time pair has not yet occurred. Drop this marker.
          map.removeLayer( timelayers[t].geo );
          lastCoord = null;
          continue;
        }
        // continue reading coordinates from this marker
        lastCoord = timelayers[t].ll;
      }
      else if( lastCoord && nowtime > timelayers[t].time * 1 ){
        // continue reading coordinates from this marker
        lastCoord = timelayers[t].ll;
      }
      else if( lastCoord ){
        // reached a coordinate past the end time
        // map last coordinate
        timelayers[t].geo.setLatLng( lastCoord );
        if(!map.hasLayer( timelayers[t].geo )){
          map.addLayer( timelayers[t].geo );
        }
        lastCoord = null;
      }
    }
    else{
      // fixed items with a start, an end, or both
      if(typeof timelayers[t].start != 'undefined'){
        if(timelayers[t].start * 1 > nowtime){
          // geo hasn't started
          map.removeLayer(timelayers[t].geo);
        }
        else if(typeof timelayers[t].end == 'undefined'){
          // geo has started, has no end
          if(!map.hasLayer(timelayers[t].geo)){
            map.addLayer(timelayers[t].geo);
          }
        }
        else if(timelayers[t].end * 1 > nowtime){
          // geo has started, not yet ended
          if(!map.hasLayer(timelayers[t].geo)){
            map.addLayer(timelayers[t].geo);
          }
        }
        else{
          // geo has ended
          map.removeLayer(timelayers[t].geo);
        }
      }
      else{
        // start wasn't defined, but end must be
        if(timelayers[t].end * 1 > nowtime){
          // geo has not yet ended
          if(!map.hasLayer(timelayers[t].geo)){
            map.addLayer(timelayers[t].geo);
          }
        }
        else{
          map.removeLayer(timelayers[t].geo);        
        }
      }
    }
  }
}

function jsonmap(feature, layer){
  var timefeature = { geo: layer };
  
  // read map boundaries
  if(feature.geometry.type == "Polygon"){
    var pts = feature.geometry.coordinates[0];
    for(var p=0;p<pts.length;p++){
      minlat = Math.min(minlat, pts[p][1]);
      maxlat = Math.max(maxlat, pts[p][1]);
      minlng = Math.min(minlng, pts[p][0]);
      maxlng = Math.max(maxlng, pts[p][0]);
    }
  }
  
  // read any start and end times
  if(typeof feature.properties.start != 'undefined'){
    if(isNaN(feature.properties.start * 1)){
      timefeature.start = new Date(feature.properties.start);
    }
    else if(feature.properties.start * 1 >= 100 && feature.properties.start * 1 <= 5000){
      timefeature.start = new Date("January 10, " + feature.properties.start);
    }
    else{
      timefeature.start = new Date(1 * feature.properties.start);
    }
    mintime = Math.min( mintime, timefeature.start * 1 );
    maxtime = Math.max( maxtime, timefeature.start * 1 );
  }
  if(typeof feature.properties.end != 'undefined'){
    if(isNaN(feature.properties.end * 1)){
      timefeature.end = new Date(feature.properties.end);
    }
    else if(feature.properties.end * 1 >= 100 && feature.properties.end * 1 <= 5000){
      timefeature.end = new Date("January 10, " + feature.properties.end);
    }
    else{
      timefeature.end = new Date(1 * feature.properties.end);
    }
    mintime = Math.min( mintime, timefeature.end * 1 );
    maxtime = Math.max( maxtime, timefeature.end * 1 );
  }
            
  if(DEBUG && typeof timefeature.start == 'undefined' && typeof timefeature.end == 'undefined'){
    // no start or end. Add a random date in DEBUG mode
    timefeature.start = new Date( "January 10, " + Math.round(Math.random() * 100 + 1900) );
    timefeature.end = new Date( timefeature.start * 1 + Math.round(Math.random() * 20 * 365 * 24 * 60 * 60 * 1000) );

    mintime = Math.min( mintime, timefeature.start * 1 );
    maxtime = Math.max( maxtime, timefeature.start * 1 );
    mintime = Math.min( mintime, timefeature.end * 1 );
    maxtime = Math.max( maxtime, timefeature.end * 1 );
    timelayers.push(timefeature);
  }
  else if(typeof timefeature.start == 'undefined' && typeof timefeature.end == 'undefined'){
    // no start or end, so just add it to the map
    layer.setStyle({ clickable: false });
    map.addLayer(layer);
  }
  else{
    // save this timefeature
    timelayers.push(timefeature);
  }
}

function kmlmap(placemark){
  var geos = [];
  if(placemark.getElementsByTagName("Point").length){
    // KML Points
    var pts = placemark.getElementsByTagName("Point");
    for(var i=0;i<pts.length;i++){
      var pt = pts[i];
      var coords = $(pts[i].getElementsByTagName("coordinates")[0]).text().split(',');
      geos.push( new L.marker( new L.LatLng( coords[1], coords[0] ), { clickable: false } ) );
      
      minlat = Math.min( minlat, coords[1] );
      maxlat = Math.max( maxlat, coords[1] );
      minlng = Math.min( minlng, coords[0] );
      maxlng = Math.max( maxlng, coords[0] );
    }
  }
  if(placemark.getElementsByTagName("Polygon").length){
    // KML Polygons
    var polys = placemark.getElementsByTagName("Polygon");
    for(var i=0;i<polys.length;i++){
      var poly = polys[i];
      var coords;
      if(poly.getElementsByTagName("outerBoundaryIs").length){
        coords = poly.getElementsByTagName("outerBoundaryIs")[0].getElementsByTagName("coordinates")[0];
      }
      else{
        coords = poly.getElementsByTagName("coordinates")[0];
      }
      coords = $(coords).text().split(' ');
      for(var pt=0;pt<coords.length;pt++){
        coords[pt] = coords[pt].split(',');
        coords[pt] = new L.LatLng( coords[pt][1], coords[pt][0] );

        minlat = Math.min( minlat, coords[pt].lat );
        maxlat = Math.max( maxlat, coords[pt].lat );
        minlng = Math.min( minlng, coords[pt].lng );
        maxlng = Math.max( maxlng, coords[pt].lng );
      }
      geos.push( new L.polygon( coords, { clickable: false } ) );
    }
  }
  return geos;
}