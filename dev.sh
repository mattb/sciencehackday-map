watchify map.js --debug -o map-bundle.js -t [ babelify --presets [ es2015 ] ] &
python -m SimpleHTTPServer
