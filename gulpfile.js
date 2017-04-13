const gulp = require('gulp');
const browserify = require('browserify');
const babelify = require('babelify');
const source = require('vinyl-source-stream');
const localScreenshots = require('gulp-local-screenshots');

gulp.task('build', () =>
  browserify({ entries: './map.js', debug: true })
    .transform(babelify, { presets: ['es2015'] })
    .bundle()
    .pipe(source('bundle.js'))
    .pipe(gulp.dest('dist')));

gulp.task('watch', ['build'], () => {
  gulp.watch('*.js', ['build']);
});

gulp.task('default', ['watch']);

gulp.task('screens', () => {
  gulp
    .src('index.html')
    .pipe(
      localScreenshots({
        timeout: 1000,
        width: ['1000'],
        path: './'
      })
    )
    .pipe(gulp.dest('./screenshots/'));
});
