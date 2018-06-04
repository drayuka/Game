module.exports = function(grunt) {

    grunt.loadNpmTasks('grunt-screeps');
    var config = require('./.screeps.json');
    grunt.initConfig({
        screeps: {
            options: {
                email: config.email,
                password: config.password,
                branch: config.branch,
                ptr: config.ptr
            },
            dist: {
                src: [
                    'src/*.js',
                    'node_modules/immutable/dist/immutable.min.js'
                ],
                cwd: 'dist/',
                flatten: true,
                expand: true
            }
        }
    });

    grunt.registerTask('default', ['screeps'])
}

