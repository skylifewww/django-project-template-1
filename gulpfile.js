var gulp = require('gulp');
var uglify = require('gulp-uglify');
var notify = require('gulp-notify');
var plumber = require('gulp-plumber');
var cssmin = require('gulp-cssmin');
var rename = require("gulp-rename");
var sass = require('gulp-sass');
var path = require('path');
var browserSync = require('browser-sync').create();
var webpack_stream = require('webpack-stream');
var webpack = require('webpack');
var duration = require('gulp-duration');


var spawn = require('child_process').spawn;
var argv = require('yargs')
    .default('host', '127.0.0.1')
    .default('port', 3000)
    .default('bsync-port', 8000)
    .argv;
var djangoAddress = argv.host + ":" + argv.port;


var jsTask = function (options) {
    var webpackConfig = require('./webpack.config.js');
    webpackConfig.entry = {
        'bundle': options.src
    };
    webpackConfig.plugins = webpackConfig.plugins.concat([
        new webpack.ProvidePlugin({
            $: "jquery",
            jQuery: "jquery",
            "window.jQuery": "jquery"
        })
    ])

    if (options.development) {
        webpackConfig.watch = true;
        webpackConfig.plugins = webpackConfig.plugins.concat([
            new webpack.NoErrorsPlugin()
        ]);

        gulp.src(options.src)
            .pipe(webpack_stream(webpackConfig))
            .on('error', function (error) {
                console.log(error.message);
                this.emit('end');
            })
            .pipe(gulp.dest(options.dest))
    } else {
        webpackConfig.plugins = webpackConfig.plugins.concat([
            // removes a lot of debugging code in React
            new webpack.DefinePlugin({
                'process.env': {
                    'NODE_ENV': JSON.stringify('production')
                }
            }),
            new webpack.optimize.OccurenceOrderPlugin(),
            new webpack.optimize.UglifyJsPlugin({compressor: {warnings: false}})
        ]);

        gulp.src(options.src)
            .pipe(webpack_stream(webpackConfig))
            .pipe(gulp.dest(options.dest));
    }
};


var cssTask = function (options) {
    var sassOpts = {
        includePaths: ['node_modules']
    };
    if (options.development) {
        var run = function () {
            gulp.src(options.src)
                .pipe(duration('CSS bundle'))
                .pipe(plumber())
                .pipe(sass(sassOpts))
                .pipe(rename('bundle.css'))
                .pipe(gulp.dest(options.dest))
                .pipe(browserSync.stream())
        };
        run();
        gulp.watch(options.watch, run);
    } else {
        gulp.src(options.src)
            .pipe(sass(sassOpts))
            .pipe(rename('bundle.css'))
            .pipe(cssmin())
            .pipe(gulp.dest(options.dest));
    }
};


function rebuild(options) {
    var options = options || {};

    cssTask({
        development: options.development,
        src: './assets/sass/index.scss',
        watch: './assets/sass/**/*.scss',
        dest: './src/{{ project_name }}/static/build/'
    });

    jsTask({
        development: options.development,
        src: './assets/js/index.js',
        watch: './assets/js/**/*.jsx?',
        dest: './src/{{ project_name }}/static/build/'
    });
}


function runDjango(address) {
    if (!process.env['VIRTUAL_ENV']) {
        console.warn("WARNING: To run django you should activate virtual environment")
    } else {
        console.log("Starting Django runserver http://" + address);
        var args = ["src/manage.py", "runserver", address];
        var python = process.env['VIRTUAL_ENV'] + '/bin/python';
        var runserver = spawn(python, args, {
            stdio: "inherit"
        });
        runserver.on('close', function (code) {
            if (code !== 0) {
                console.error('Django runserver exited with error code: ' + code);
            } else {
                console.log('Django runserver exited normally.');
            }
        });
    }
}


// Run in development
gulp.task('default', function (cb) {

    rebuild({
        development: true
    });

    runDjango(djangoAddress);

    browserSync.init({
        proxy: djangoAddress,
        port: argv['bsync-port']
    });

});


// Run before deploy to production
gulp.task('deploy', function () {
    rebuild({
        development: false
    });
});