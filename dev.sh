watchify map.js --debug -o bundle.js -t [ babelify --presets [ es2015 ] ] &
python -m SimpleHTTPServer
