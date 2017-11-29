module.exports = function(grunt) {

    grunt.loadNpmTasks('grunt-screeps');
    var config = require('./.screeps.json');
    grunt.initConfig({
        screeps: {
            options: {
                email: config.email,
                password: config.password,
                branch: 'mining',
                ptr: config.ptr
            },
            dist: {
                src: [
                    'dist/*.js',
                    'node_modules/immutable/**/*.js'
                ]
            }
        }
    });

    grunt.registerTask('default', ['screeps'])
}

