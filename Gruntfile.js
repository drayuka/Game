module.exports = function(grunt) {
    require('time-grunt')(grunt);
    grunt.loadNpmTasks('grunt-screeps');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-ts'); 
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
                src: ['dist/*.js']
            }
        },
        clean: {
            'dist': ['dist']
        },
        ts: {
            default: {
                tsconfig: true,
            }
        }
    });

    grunt.registerTask('default', ['clean','ts','screeps'])
}

