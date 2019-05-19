var async = require('async');

module.exports = function(GitHubConfig, octokit, collection, callback) {
    if (!collection.apps ||
        !collection.apps.listRepos ||
        !collection.apps.listRepos.data ||
        !collection.apps.listRepos.data.repositories) {
        collection.repos.listDeployKeys = {};
        return callback();
    }

    var repos = collection.apps.listRepos.data.repositories;
    var owner = GitHubConfig.login;

    async.eachLimit(repos, 15, function(repoObj, cb){
        var repo = repoObj.name;
        collection.repos.listDeployKeys[repo] = {};

        octokit['repos']['listDeployKeys']({owner, repo}).then(function(results){
            if (results && results.data) collection.repos.listDeployKeys[repo].data = results.data;
            cb();
        }, function(err){
            if (err) collection.repos.listDeployKeys[repo].err = err;
            cb();
        });
    }, function(){
        callback();
    });
};