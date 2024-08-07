var async   = require('async');
var helpers = require('../../../helpers/google');
const { compliance } = require('./instanceDefaultServiceAccount');

module.exports = {
    title: 'Instance Public Access Disabled',
    category: 'Compute',
    domain: 'Compute',
    severity: 'High',
    description: 'Ensures that compute instances are not configured to allow public access.',
    more_info: 'Compute Instances should always be configured behind load balancers instead of having public IP addresses ' +
        'in order to minimize the instance\'s exposure to the internet.',
    link: 'https://cloud.google.com/compute/docs/ip-addresses/reserve-static-external-ip-address',
    recommended_action: 'Modify compute instances and set External IP to None for network interface',
    apis: ['compute:list'],
    realtime_triggers: ['compute.instances.insert', 'compute.instances.delete', 'compute.instances.updateNetworkInterface'],
    compliance: {
        cis3: '4.9 Ensure That Compute Instances Do Not Have Public IP Addresses'
    },

    run: function(cache, settings, callback) {
        var results = [];
        var source = {};
        var regions = helpers.regions();

        let projects = helpers.addSource(cache, source,
            ['projects','get', 'global']);

        if (!projects || projects.err || !projects.data || !projects.data.length) {
            helpers.addResult(results, 3,
                'Unable to query for projects: ' + helpers.addError(projects), 'global', null, null, (projects) ? projects.err : null);
            return callback(null, results, source);
        }

        var project = projects.data[0].name;

        async.each(regions.compute, (region, rcb) => {
            var zones = regions.zones;
            var noInstances = [];
            async.each(zones[region], function(zone, zcb) {
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
                    if (instance.name && instance.name.startsWith('gke-')) return;

                    let resource = helpers.createResourceName('instances', instance.name, project, 'zone', zone);

                    let found;
                    if (instance.networkInterfaces &&
                        instance.networkInterfaces.length) {
                        found = instance.networkInterfaces.find(networkObject => networkObject.accessConfigs);
                    }

                    if (found) {
                        helpers.addResult(results, 2,
                            'Public access is enabled for the instance', region, resource);
                    } else {
                        helpers.addResult(results, 0,
                            'Public access is disabled for the instance', region, resource);
                    }
                });
                zcb();
            }, function() {
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
