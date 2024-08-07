var async   = require('async');
var helpers = require('../../../helpers/google');
const { compareVersions } = require('../../../helpers/shared');
const { compliance } = require('../vpcnetwork/openSSH');

module.exports = {
    title: 'Instance Default Service Account',
    category: 'Compute',
    domain: 'Compute',
    severity: 'Medium',
    description: 'Ensures that compute instances are not configured to use the default service account.',
    more_info: 'Default service account has the editor role permissions. Due to security reasons it should not be used for any instance.',
    link: 'https://cloud.google.com/compute/docs/access/service-accounts',
    recommended_action: 'Make sure that compute instances are not using default service account',
    apis: ['compute:list', 'projects:get'],
    realtime_triggers: ['compute.projects.insert', 'compute.projects.delete', 'compute.instances.insert', 'compute.instances.delete', 'compute.instances.setservicezccount'],
    compliance: {
        cis3: '4.1 Ensure That Instances Are Not Configured To Use the Default Service Account'
    },

    run: function(cache, settings, callback) {
        var results = [];
        var source = {};
        var regions = helpers.regions();

        let projects = helpers.addSource(cache, source,
            ['projects','get', 'global']);

        if (!projects) return callback(null, results, source);

        if (projects.err || !projects.data) {
            helpers.addResult(results, 3,
                'Unable to query for projects: ' + helpers.addError(projects), 'global');
            return callback(null, results, source);
        }

        if (!projects.data.length) {
            helpers.addResult(results, 0, 'No projects found', 'global');
            return callback(null, results, source);
        }

        var defaultServiceAccount = projects.data[0].defaultServiceAccount;
        var project = projects.data[0].name;

        if (!defaultServiceAccount) return callback(null, results, source);

        async.each(regions.compute, (region, rcb) => {
            var zones = regions.zones;
            var noInstances = [];
            async.each(zones[region], (zone, zcb) => {
                var instances = helpers.addSource(cache, source,
                    ['compute','list', zone]);

                if (!instances) return zcb();

                if (instances.err || !instances.data) {
                    helpers.addResult(results, 3, 'Unable to query instances', region, null, null, instances.err);
                    return zcb();
                }

                if (!instances.data.length) {
                    noInstances.push(zone);
                    return zcb();
                }

                instances.data.forEach(instance => {
                    let found;
                    let resource = helpers.createResourceName('instances', instance.name, project, 'zone', zone);
                    if (instance.serviceAccounts &&
                        instance.serviceAccounts.length) {
                        found = instance.serviceAccounts.find(account => account.email == defaultServiceAccount);
                    }
                    if (found) {
                        helpers.addResult(results, 2,
                            'Default service account is used for instance', region, resource);
                    } else {
                        helpers.addResult(results, 0,
                            'Default service account is not used for instance', region, resource);
                    }
                });
                
                zcb();
            }, function(){
                if (noInstances.length) {
                    helpers.addResult(results, 0, `No instances found in following zones: ${noInstances.join(', ')}`, region);
                }
                rcb();
            });
        }, function() {
            callback(null, results, source);
        });
    }
};
