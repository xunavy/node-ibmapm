// Copyright IBM Corp. 2017. All Rights Reserved.
// Node module: ibmapm
// This file is licensed under the Apache License 2.0.
// License text available at https://opensource.org/licenses/Apache-2.0

var fs = require( 'fs' );
var os = require( 'os' );
var child = require( 'child_process' );
var url = require( 'url' );
var HttpRequest = require( './http-request' );
var jsonSender = require('./json-sender').jsonSender;

var maxRequestSize = 50;

function Metric( inInterval ) {
    this.host = os.hostname().split( '.' ).shift();
    this.pid = process.pid;
    this.entryFile = undefined;

    var reg = '\/.\+\.js$';
    var index;
    var argv = process.argv;
    for( index = 1; index < argv.length; index ++ )  {
        var argument = argv[index];
        var jsFile = argument;
        if( !argument.match( reg ) )  {
            jsFile = argument + ".js";
        }
        try  {
            var stats = fs.statSync( jsFile );
            if( stats.isFile() )  {
                this.entryFile = jsFile;
                break;
            }
        }
        catch( err )  {
            continue;
        }
    }

    this.originNode = undefined;
    this.port = undefined;
    this.type = undefined;

    this.sysCpuPercentage = undefined;
    this.sysMemAll = undefined;
    this.sysMemUsed = undefined;
    this.sysMemFree = undefined;  

    this.cpuPercentage = undefined;
    this.memRss = undefined;
    this.memAll = undefined;
    this.upTime = undefined;
    this.interval = inInterval * 2;
    this.totalRequests = 0;
    this.requestRate = 0;
    this.totalResponseTime = 0;
    this.averageResponseTime = 0;
    this.maxRespTime = 0;
    this.requests = {};
    this.config = undefined;
    this.gc = {
            size: 0,
            used: 0,
            duration: 0,
            m_count: 0,
            s_count: 0
    };
    this.eventLoop = {
        time: 0,
        latency_min: 0,
        latency_max: 0,
        latency_avg: 0,
        loop_count: 0,
        loop_minimum: 0,
        loop_maximum: 0,
        loop_average: 0
    };
    this.preHeapUsed = 0;
    this.preHeapSize = 0;
    this.profiling = {};

    this.socketio_totalRequests = 0;
    this.socketio_requestRate = 0;
    this.socketio_totalResponseTime = 0;
    this.socketio_averageResponseTime = 0;
    this.socketio_maxRespTime = 0;

    this.mysql_totalRequests = 0;
    this.mysql_requestRate = 0;
    this.mysql_totalResponseTime = 0;
    this.mysql_averageResponseTime = 0;
    this.mysql_maxRespTime = 0;

    this.mongo_totalRequests = 0;
    this.mongo_requestRate = 0;
    this.mongo_totalResponseTime = 0;
    this.mongo_averageResponseTime = 0;
    this.mongo_maxRespTime = 0;

    this.mqtt_totalRequests = 0;
    this.mqtt_requestRate = 0;
    this.mqtt_totalResponseTime = 0;
    this.mqtt_averageResponseTime = 0;
    this.mqtt_maxRespTime = 0;

    this.mqlight_totalRequests = 0;
    this.mqlight_requestRate = 0;
    this.mqlight_totalResponseTime = 0;
    this.mqlight_averageResponseTime = 0;
    this.mqlight_maxRespTime = 0;

    this.leveldb_totalRequests = 0;
    this.leveldb_requestRate = 0;
    this.leveldb_totalResponseTime = 0;
    this.leveldb_averageResponseTime = 0;
    this.leveldb_maxRespTime = 0;

    this.redis_totalRequests = 0;
    this.redis_requestRate = 0;
    this.redis_totalResponseTime = 0;
    this.redis_averageResponseTime = 0;
    this.redis_maxRespTime = 0;

    this.riak_totalRequests = 0;
    this.riak_requestRate = 0;
    this.riak_totalResponseTime = 0;
    this.riak_averageResponseTime = 0;
    this.riak_maxRespTime = 0;

    this.memcached_totalRequests = 0;
    this.memcached_requestRate = 0;
    this.memcached_totalResponseTime = 0;
    this.memcached_averageResponseTime = 0;
    this.memcached_maxRespTime = 0;

    this.oracledb_totalRequests = 0;
    this.oracledb_requestRate = 0;
    this.oracledb_totalResponseTime = 0;
    this.oracledb_averageResponseTime = 0;
    this.oracledb_maxRespTime = 0;

    this.oracle_totalRequests = 0;
    this.oracle_requestRate = 0;
    this.oracle_totalResponseTime = 0;
    this.oracle_averageResponseTime = 0;
    this.oracle_maxRespTime = 0;

    this.strongoracle_totalRequests = 0;
    this.strongoracle_requestRate = 0;
    this.strongoracle_totalResponseTime = 0;
    this.strongoracle_averageResponseTime = 0;
    this.strongoracle_maxRespTime = 0;

    this.postgresql_totalRequests = 0;
    this.postgresql_requestRate = 0;
    this.postgresql_totalResponseTime = 0;
    this.postgresql_averageResponseTime = 0;
    this.postgresql_maxRespTime = 0;

    //???
    //this.express_totalRequests = 0;
    //this.express_requestRate = 0;
    //this.express_totalResponseTime = 0;
    //this.express_averageResponseTime = 0;
    //this.express_maxRespTime = 0;
        var appmetrics = global.APPMETRICS = global.APPMETRICS || require('appmetrics');
        var healthcenter = global.HEALTHCENTER = global.HEALTHCENTER || appmetrics.monitor();
        var self = this;

        healthcenter.on('initialized', function (env) {
            jsonSender.setEnvironment(env);
        });

        healthcenter.on('cpu', function(cpu) {
            self.cpuPercentage = (cpu.process * 100);   // CPU as a percentage
            self.sysCpuPercentage = (cpu.system * 100); //whole system cpu as a percentage
        });
        healthcenter.on('memory', function(memory) {
            self.memRss = memory.physical;              // RSS in bytes - conversion to MB is done later
            self.memAll = memory.private;               // All memory usage in bytes - conversion to MB is done later
            self.sysMemAll = memory.physical_total;     // the total amount of RAM available on the system in bytes
            self.sysMemUsed = memory.physical_used;     // the total amount of RAM in use on the system in bytes
            self.sysMemFree = memory.physical_free;     // the total amount of free RAM on the system in bytes
        });
        healthcenter.on('http', function(http) {
            self.addHttpRequest(http, http.duration);
        });
        healthcenter.on('http-outbound', function(http){

            self.addHttpOutbound(http,http.duration);
        });
        
        healthcenter.on('gc', function(gc) {
            if(self.gc == undefined){
                self.gc = {
                        size: 0,
                        used: 0,
                        duration: 0,
                        m_count: 0,
                        s_count: 0
                };
            }
            self.gc.size = gc.size;
            self.gc.used = gc.used;
            self.gc.duration += gc.duration;
            if( gc.type == 'M'){
                self.gc.m_count++;
            }else{
                self.gc.s_count++;
            }
        });
        
        healthcenter.on('eventloop',function(el){
        //sample data: { time: 1476322256592, latency: { min: 12.497753, max: 12.497753, avg: 12.497753 } }
            if(el){
                self.eventLoop.time = el.time;
                self.eventLoop.latency_min = el.latency.min;
                self.eventLoop.latency_max = el.latency.max;
                self.eventLoop.latency_avg = el.latency.avg;
            }
        });
        
        healthcenter.on('loop',function(l){
        //sample data: { minimum: 0, maximum: 1, count: 4047, average: 0 }
            if(l){
                self.eventLoop.loop_count = l.count;
                self.eventLoop.loop_minimum = l.minimum;
                self.eventLoop.loop_maximum = l.maximum;
                self.eventLoop.loop_average = l.average;
            }
        });
        
        healthcenter.on('profiling', function(profiling) {

            var funcs = profiling.functions;
            var counter = 0;
            var samplingCount = 0;
            for( var i in funcs){
                samplingCount += funcs[i].count;
                if(typeof funcs[i] !== 'object' || funcs[i].parent==0 || funcs[i].file == '' 
                    || funcs[i].file.indexOf('node_modules')>=0 || funcs[i].file.indexOf('native ')==0
                    || funcs[i].file.indexOf('internal/')==0 || funcs[i].file.indexOf('_')==0
                    || ['buffer.js','cluster.js','dns.js','domain.js','errors.js',
                    'events.js','fs.js','http.js','https.js',
                    'net.js','os.js','path.js','querystring.js','readline.js','repl.js','stream.js',
                    'timers.js','tls.js','string_decoder.js','tty.js','dgram.js','url.js',
                    'util.js','v8.js','vm.js','zlib.js','assert.js','child_process.js','console.js',
                    'crypto.js'].indexOf(funcs[i].file) >= 0){
                    continue;
                }
                counter++;
               var key = funcs[i].file + "_" + funcs[i].line + funcs[i].name;
               if( key in self.profiling ){
                   self.profiling[key].count += funcs[i].count;
               }else{
                   self.profiling[key] = funcs[i];
               }
            }

            if(counter > 0){
                self.profilingMeta = {
                    //time: profiling.time,
                    count: samplingCount
                };

            }

        });

        healthcenter.on('socketio', function(data){
            //console.info(data);
            var responseTime = data.duration;
            self.socketio_totalRequests ++;
            self.socketio_totalResponseTime += responseTime;
            self.socketio_maxRespTime = (self.socketio_maxRespTime >= responseTime) ? self.socketio_maxRespTime : responseTime;
            self.socketio_requestRate = self.socketio_totalRequests / self.interval * 60 >>> 0;
            self.socketio_averageResponseTime = self.socketio_totalResponseTime / self.socketio_totalRequests >>> 0;
        });

        healthcenter.on('mysql', function(data){
            //console.info(data);
            var responseTime = data.duration;
            self.mysql_totalRequests ++;
            self.mysql_totalResponseTime += responseTime;
            self.mysql_maxRespTime = (self.mysql_maxRespTime >= responseTime) ? self.mysql_maxRespTime : responseTime;
            self.mysql_requestRate = self.mysql_totalRequests / self.interval * 60 >>> 0;
            self.mysql_averageResponseTime = self.mysql_totalResponseTime / self.mysql_totalRequests >>> 0;
        });

        healthcenter.on('mongo', function(data){
            //console.info(data);
            var responseTime = data.duration;
            self.mongo_totalRequests ++;
            self.mongo_totalResponseTime += responseTime;
            self.mongo_maxRespTime = (self.mongo_maxRespTime >= responseTime) ? self.mongo_maxRespTime : responseTime;
            self.mongo_requestRate = self.mongo_totalRequests / self.interval * 60 >>> 0;
            self.mongo_averageResponseTime = self.mongo_totalResponseTime / self.mongo_totalRequests >>> 0;
        });

        healthcenter.on('mqtt', function(data){
            //console.info(data);
            var responseTime = data.duration;
            self.mqtt_totalRequests ++;
            self.mqtt_totalResponseTime += responseTime;
            self.mqtt_maxRespTime = (self.mqtt_maxRespTime >= responseTime) ? self.mqtt_maxRespTime : responseTime;
            self.mqtt_requestRate = self.mqtt_totalRequests / self.interval * 60 >>> 0;
            self.mqtt_averageResponseTime = self.mqtt_totalResponseTime / self.mqtt_totalRequests >>> 0;
        });

        healthcenter.on('mqlight', function(data){
            //console.info(data);
            var responseTime = data.duration;
            self.mqlight_totalRequests ++;
            self.mqlight_totalResponseTime += responseTime;
            self.mqlight_maxRespTime = (self.mqlight_maxRespTime >= responseTime) ? self.mqlight_maxRespTime : responseTime;
            self.mqlight_requestRate = self.mqlight_totalRequests / self.interval * 60 >>> 0;
            self.mqlight_averageResponseTime = self.mqlight_totalResponseTime / self.mqlight_totalRequests >>> 0;
        });

        healthcenter.on('leveldown', function(data){
            //console.info(data);
            var responseTime = data.duration;
            self.leveldb_totalRequests ++;
            self.leveldb_totalResponseTime += responseTime;
            self.leveldb_maxRespTime = (self.leveldb_maxRespTime >= responseTime) ? self.leveldb_maxRespTime : responseTime;
            self.leveldb_requestRate = self.leveldb_totalRequests / self.interval * 60 >>> 0;
            self.leveldb_averageResponseTime = self.leveldb_totalResponseTime / self.leveldb_totalRequests >>> 0;
        });

        healthcenter.on('redis', function(data){
            //console.info(data);
            var responseTime = data.duration;
            self.redis_totalRequests ++;
            self.redis_totalResponseTime += responseTime;
            self.redis_maxRespTime = (self.redis_maxRespTime >= responseTime) ? self.redis_maxRespTime : responseTime;
            self.redis_requestRate = self.redis_totalRequests / self.interval * 60 >>> 0;
            self.redis_averageResponseTime = self.redis_totalResponseTime / self.redis_totalRequests >>> 0;
        });

        healthcenter.on('riak', function(data){
            //console.info(data);
            var responseTime = data.duration;
            self.riak_totalRequests ++;
            self.riak_totalResponseTime += responseTime;
            self.riak_maxRespTime = (self.riak_maxRespTime >= responseTime) ? self.riak_maxRespTime : responseTime;
            self.riak_requestRate = self.riak_totalRequests / this.interval * 60 >>> 0;
            self.riak_averageResponseTime = self.riak_totalResponseTime / self.riak_totalRequests >>> 0;
        });

        healthcenter.on('memcached', function(data){
            //console.info(data);
            var responseTime = data.duration;
            self.memcached_totalRequests ++;
            self.memcached_totalResponseTime += responseTime;
            self.memcached_maxRespTime = (self.memcached_maxRespTime >= responseTime) ? self.memcached_maxRespTime : responseTime;
            self.memcached_requestRate = self.memcached_totalRequests / this.interval * 60 >>> 0;
            self.memcached_averageResponseTime = self.memcached_totalResponseTime / self.memcached_totalRequests >>> 0;
        });

        healthcenter.on('oracledb', function(data){
            //console.info(data);
            var responseTime = data.duration;
            self.oracledb_totalRequests ++;
            self.oracledb_totalResponseTime += responseTime;
            self.oracledb_maxRespTime = (self.oracledb_maxRespTime >= responseTime) ? self.oracledb_maxRespTime : responseTime;
            self.oracledb_requestRate = self.oracledb_totalRequests / this.interval * 60 >>> 0;
            self.oracledb_averageResponseTime = self.oracledb_totalResponseTime / self.oracledb_totalRequests >>> 0;
        });

        healthcenter.on('oracle', function(data){
            //console.info(data);
            var responseTime = data.duration;
            self.oracle_totalRequests ++;
            self.oracle_totalResponseTime += responseTime;
            self.oracle_maxRespTime = (self.oracle_maxRespTime >= responseTime) ? self.oracle_maxRespTime : responseTime;
            self.oracle_requestRate = self.oracle_totalRequests / this.interval * 60 >>> 0;
            self.oracle_averageResponseTime = self.oracle_totalResponseTime / self.oracle_totalRequests >>> 0;
        });

        healthcenter.on('strong-oracle', function(data){
            //console.info(data);
            var responseTime = data.duration;
            self.strongoracle_totalRequests ++;
            self.strongoracle_totalResponseTime += responseTime;
            self.strongoracle_maxRespTime = (self.strongoracle_maxRespTime >= responseTime) ? self.strongoracle_maxRespTime : responseTime;
            self.strongoracle_requestRate = self.strongoracle_totalRequests / this.interval * 60 >>> 0;
            self.strongoracle_averageResponseTime = self.strongoracle_totalResponseTime / self.strongoracle_totalRequests >>> 0;
        });

        healthcenter.on('postgres', function(data){
            //console.info(data);
            var responseTime = data.duration;
            self.postgresql_totalRequests ++;
            self.postgresql_totalResponseTime += responseTime;
            self.postgresql_maxRespTime = (self.postgresql_maxRespTime >= responseTime) ? self.postgresql_maxRespTime : responseTime;
            self.postgresql_requestRate = self.postgresql_totalRequests / this.interval * 60 >>> 0;
            self.postgresql_averageResponseTime = self.postgresql_totalResponseTime / self.postgresql_totalRequests >>> 0;
        });
}

var getServerPort = function () {
    var handles = global.process._getActiveHandles();
    var port = 'unknown';
    handles.forEach(function (handle) {
        if (handle.hasOwnProperty('_connectionKey')) {
            var key = handle._connectionKey;
            var terms = key.split(':');
            port = terms[terms.length-1];
        }
    });
    return port;
};

var getDeploymentType = function () {
      cluster = require('cluster');
      if (cluster.isWorker) return 'cluster';
      if ((cluster.isMaster) && (Object.keys(cluster.workers).length > 1)) return 'cluster';
      return 'single';
};

Metric.prototype.isAppMetricInitialized = function isAppMetricInitialized() {
	return this.appMetricInitialized;
}

Metric.prototype.getEnvironment = function getEnvironment() {
	return this.environment;
}

Metric.prototype.collectRunTimeInfo = function collectRunTimeInfo(zeroRunCallback)  {

    var self = this;

    //upTime
    var upTime = process.uptime();
    this.upTime = ( upTime/( 24*60*60 )>>>0 ) + 'd ' + ( upTime%( 24*60*60 )/( 60*60 )>>>0 ) + 'h ' + ( upTime%( 60*60 )/60>>>0 ) + 'm ' + ( upTime%60>>>0 ) + 's';
    
    //if zeroRunCallback is set it means app is most probably not initialized yet
    //port, type
    if( !this.originNode && !zeroRunCallback)  {
            self.port = getServerPort();
            console.log('Set port to ' + self.port);
            self.type = getDeploymentType();
            self.originNode = self.host + '_' + self.port;
    }

    //The first call in 'CloudOE' and 'Cloudnative' envType
    if (zeroRunCallback) {
        zeroRunCallback();
    }
};

Metric.prototype.addHttpRequest = function addHttpRequest( req, responseTime )  {
    var identifier = req.method + ' ' + req.url;
    jsonSender.sendAAR(req);
    this.totalRequests ++;
    this.totalResponseTime += responseTime;
    this.maxRespTime = (this.maxRespTime >= responseTime) ? this.maxRespTime : responseTime;
    this.requestRate = this.totalRequests / this.interval * 60 >>> 0;
    this.averageResponseTime = this.totalResponseTime / this.totalRequests >>> 0;
    var requests = this.requests;

    if( requests )  {
        if( !requests[ identifier ] )  {
            var requestsSize = Object.keys( requests ).length;
            if( requestsSize < maxRequestSize - 1 )  {
                request = new HttpRequest( req, responseTime );
                requests[ identifier ] = request;
            }
        }
        else  {
            request = requests[ identifier ];
            request.updateResponseTime( req, responseTime );
        }
    }
};


Metric.prototype.addHttpOutbound = function addHttpOutbound( req, responseTime )  {
    jsonSender.storeForAAR(req);
}

Metric.prototype.reset = function reset()  {

    this.requestRate = 0;
    this.totalRequests = 0;
    this.totalResponseTime = 0;
    this.averageResponseTime = 0;
    this.maxRespTime = 0;
    this.gc = {
            size: 0,
            used: 0,
            duration: 0,
            m_count: 0,
            s_count: 0
    };
    
    this.eventLoop = {
        time: 0,
        latency_min: 0,
        latency_max: 0,
        latency_avg: 0,
        loop_count: 0,
        loop_minimum: 0,
        loop_maximum: 0,
        loop_average: 0
    };
    this.profiling = {};

    for( var key in this.requests )  {
        delete this.requests[key];
    }

    this.socketio_totalRequests = 0;
    this.socketio_requestRate = 0;
    this.socketio_totalResponseTime = 0;
    this.socketio_averageResponseTime = 0;
    this.socketio_maxRespTime = 0;

    this.mysql_totalRequests = 0;
    this.mysql_requestRate = 0;
    this.mysql_totalResponseTime = 0;
    this.mysql_averageResponseTime = 0;
    this.mysql_maxRespTime = 0;

    this.mongo_totalRequests = 0;
    this.mongo_requestRate = 0;
    this.mongo_totalResponseTime = 0;
    this.mongo_averageResponseTime = 0;
    this.mongo_maxRespTime = 0;

    this.mqtt_totalRequests = 0;
    this.mqtt_requestRate = 0;
    this.mqtt_totalResponseTime = 0;
    this.mqtt_averageResponseTime = 0;
    this.mqtt_maxRespTime = 0;

    this.mqlight_totalRequests = 0;
    this.mqlight_requestRate = 0;
    this.mqlight_totalResponseTime = 0;
    this.mqlight_averageResponseTime = 0;
    this.mqlight_maxRespTime = 0;

    this.leveldb_totalRequests = 0;
    this.leveldb_requestRate = 0;
    this.leveldb_totalResponseTime = 0;
    this.leveldb_averageResponseTime = 0;
    this.leveldb_maxRespTime = 0;

    this.redis_totalRequests = 0;
    this.redis_requestRate = 0;
    this.redis_totalResponseTime = 0;
    this.redis_averageResponseTime = 0;
    this.redis_maxRespTime = 0;

    this.riak_totalRequests = 0;
    this.riak_requestRate = 0;
    this.riak_totalResponseTime = 0;
    this.riak_averageResponseTime = 0;
    this.riak_maxRespTime = 0;

    this.memcached_totalRequests = 0;
    this.memcached_requestRate = 0;
    this.memcached_totalResponseTime = 0;
    this.memcached_averageResponseTime = 0;
    this.memcached_maxRespTime = 0;

    this.oracledb_totalRequests = 0;
    this.oracledb_requestRate = 0;
    this.oracledb_totalResponseTime = 0;
    this.oracledb_averageResponseTime = 0;
    this.oracledb_maxRespTime = 0;

    this.oracle_totalRequests = 0;
    this.oracle_requestRate = 0;
    this.oracle_totalResponseTime = 0;
    this.oracle_averageResponseTime = 0;
    this.oracle_maxRespTime = 0;

    this.strongoracle_totalRequests = 0;
    this.strongoracle_requestRate = 0;
    this.strongoracle_totalResponseTime = 0;
    this.strongoracle_averageResponseTime = 0;
    this.strongoracle_maxRespTime = 0;

    this.postgresql_totalRequests = 0;
    this.postgresql_requestRate = 0;
    this.postgresql_totalResponseTime = 0;
    this.postgresql_averageResponseTime = 0;
    this.postgresql_maxRespTime = 0;
};


Metric.prototype.getComputeInfo = function getComputeInfo()  {
    var xmlString = '<socketData subnode="' + this.originNode + '">' +
                    '<attrGroup name="ComputeInfo">' + 
                    '  <in>' +
                    '    <a v="' + this.sysCpuPercentage + '"/>' +
                    '    <a v="' + ( this.sysMemAll/1024/1024>>>0 ) + '"/>' +
                    '    <a v="' + ( this.sysMemUsed/1024/1024>>>0 ) + '"/>' +
                    '    <a v="' + ( this.sysMemFree/1024/1024>>>0 ) + '"/>' +
                    '  </in>' +
                    '</attrGroup>' +
                    '</socketData>';
    return xmlString;
}

Metric.prototype.getJSONComputeInfo = function getJSONComputeInfo()  {
    var jsonData = {
            SYS_CPU_P: this.sysCpuPercentage,
            SYS_MEM_ALL: this.sysMemAll/1024/1024>>>0,
            SYS_MEM_USED: this.sysMemUsed/1024/1024>>>0,
            SYS_MEM_FREE: this.sysMemFree/1024/1024>>>0
    };

    return jsonData;
};

Metric.prototype.getAppInfo = function getAppInfo()  {
    var xmlString = '<socketData subnode="' + this.originNode + '">' +
                    '<attrGroup name="AppInfo">' + 
                    '  <in>' +
                    '    <a v="' + this.entryFile + '"/>' + 
                    '    <a v="' + this.port + '"/>' +
                    '    <a v="' + this.pid + '"/>' +
                    '    <a v="' + this.cpuPercentage + '"/>' +
                    '    <a v="' + ( this.memRss/1024/1024>>>0 ) + '"/>' +
                    '    <a v="' + this.type + '"/>' +
                    '    <a v="' + this.upTime + '"/>' +
                    '    <a v="' + this.requestRate + '"/>' +
                    '    <a v="' + this.averageResponseTime + '"/>' +
                    '    <a v="' + this.maxRespTime + '"/>' +
                    '    <a v="' + ( this.memAll/1024/1024>>>0 ) + '"/>' +
                    '  </in>' +
                    '</attrGroup>' +
                    '</socketData>';
    return xmlString;
}

Metric.prototype.getJSONAppInfo = function getJSONAppInfo()  {
    var jsonData = {
            APP_ENTRY: this.entryFile,
            PORT: this.port,
            PID: this.pid,
            CPU_P: this.cpuPercentage,
            MEM_RSS: this.memRss/1024/1024>>>0,
            TYPE: this.type,
            UPTIME: parseInt(process.uptime() * 1000),
            REQRATE: this.requestRate,
            RESP_TIME: this.averageResponseTime,
            MAX_RSPTIME: this.maxRespTime,
            MEM_ALL: this.memAll/1024/1024>>>0
    };

    return jsonData;
};

Metric.prototype.getEventLoop = function getEventLoop() {
    var xmlString = '<socketData subnode="' + this.originNode + '">' +
                    '<attrGroup name="EventLoop">' + 
                    '  <in>' +
                    '    <a v="' + this.eventLoop.time + '"/>' + 
                    '    <a v="' + this.eventLoop.latency_min + '"/>' +
                    '    <a v="' + this.eventLoop.latency_max + '"/>' +
                    '    <a v="' + this.eventLoop.latency_avg + '"/>' +
                    '    <a v="' + this.eventLoop.loop_count + '"/>' +
                    '    <a v="' + this.eventLoop.loop_minimum + '"/>' +
                    '    <a v="' + this.eventLoop.loop_maximum + '"/>' +
                    '    <a v="' + this.eventLoop.loop_average + '"/>' +
                    '  </in>' +
                    '</attrGroup>' +
                    '</socketData>';
    return xmlString;
};

Metric.prototype.getJSONEventLoop = function getJSONEventLoop(){
    var jsonElData = {
            EVENTLOOP_TIME: this.eventLoop.time,
            EVENTLOOP_LATENCY_MIN: this.eventLoop.latency_min,
            EVENTLOOP_LATENCY_MAX: this.eventLoop.latency_max,
            EVENTLOOP_LATENCY_AVG: this.eventLoop.latency_avg,
            LOOP_COUNT: this.eventLoop.loop_count,
            LOOP_MINIMUM: this.eventLoop.loop_minimum,
            LOOP_MAXIMUM: this.eventLoop.loop_maximum,
            LOOP_AVERAGE: this.eventLoop.loop_average
    };
    return jsonElData;
};


Metric.prototype.getGC = function getGC() {
    var xmlString = '<socketData subnode="' + this.originNode + '">' +
    '<attrGroup name="GC">';
    var totalCount = this.gc.m_count + this.gc.s_count;
    if(totalCount){

        this.preHeapUsed = this.gc.used / totalCount / 1024 / 1024 >>> 0;
        this.preHeapSize = this.gc.size / totalCount / 1024 / 1024 >>> 0;
        var xmlRow = '  <in>' +
        '    <a v="' + (this.preHeapSize) + '"/>' + 
        '    <a v="' + (this.preHeapUsed) + '"/>' +
        '    <a v="' + this.gc.duration+ '"/>' +
        '    <a v="' + this.gc.m_count + '"/>' +
        '    <a v="' + this.gc.s_count + '"/>' +
        '  </in>';
        xmlString += xmlRow;
    }else{
        var xmlRow = '  <in>' +
        '    <a v="' + this.preHeapSize + '"/>' + 
        '    <a v="' + this.preHeapUsed + '"/>' +
        '    <a v="' + 0 + '"/>' +
        '    <a v="' + 0 + '"/>' +
        '    <a v="' + 0 + '"/>' +
        '  </in>';
        xmlString += xmlRow;
    }


    xmlString += '</attrGroup>' +
                 '</socketData>';

    return xmlString;
};


Metric.prototype.getJSONGC = function getJSONGC() {
    
    var totalCount = this.gc.m_count + this.gc.s_count;
    var jsonRequestData;
    if(totalCount){

        this.preHeapUsed = this.gc.used / totalCount / 1024 / 1024 >>> 0;
        this.preHeapSize = this.gc.size / totalCount / 1024 / 1024 >>> 0;

        jsonGCData = {
                HEAP_SIZE: this.preHeapSize,
                HEAP_USAGE: this.preHeapUsed,
                DURATION: this.gc.duration,
                M_COUNT: this.gc.m_count,
                S_COUNT: this.gc.s_count
        };
    }else{
        jsonGCData = {
                HEAP_SIZE: this.preHeapSize,
                HEAP_USAGE: this.preHeapUsed,
                DURATION: 0,
                M_COUNT: 0,
                S_COUNT: 0
        };
    }

    
        
    return jsonGCData;
};

//Metric.prototype.getProfiling = function getProfiling() {
//  var xmlString = '<socketData subnode="' + this.originNode + '">' +
//    '<attrGroup name="Prof">';
//  var funcs = this.profiling;
//  var key;
//  var isEmpty = true;
//  
//  for (key in funcs){
//      if(this.totalRequests == 0){
//          break;
//      }
//      var func = funcs[key];
////        if(typeof func !== 'object' || func.parent==0 || func.file == '' || func.file.indexOf('node_modules/ibm-apm/')>=0){
////            continue;
////        }
//      var xmlRow = '  <in>' +
//        '    <a v="' + func.file + '"/>' + 
//        '    <a v="' + func.line + '"/>' +
//        '    <a v="' + func.name + '"/>' +
//        '    <a v="' + func.count + '"/>' +
//        '  </in>';
//      xmlString += xmlRow;
//      isEmpty = false;
//  }
//  if( isEmpty )  {
//        var xmlRow = '  <in>' +
//        '    <a v="N/A"/>' +
//        '    <a v="0"/>' + 
//        '    <a v="N/A"/>' +
//        '    <a v="0"/>' +
//                     '  </in>';
//        xmlString += xmlRow;
//    }
//
//    xmlString += '</attrGroup>' +
//                 '</socketData>';
//
//    return xmlString;
//};

Metric.prototype.getJSONProfiling = function getJSONProfiling() {
   var funcs = this.profiling;
   var jsonDataArray = [];
   var key;
   for ( key in funcs )  {
       var func = funcs[key];
       if( typeof func !== 'object' || func.parent == 0)  {
           continue;
       }
       
       var jsonRequestData = {
             FILE: func.file,
             LINE: func.line,
             NAME: func.name,
             COUNT: func.count
       };
   
       jsonDataArray.push(jsonRequestData);
   }
       
   return jsonDataArray;
};

Metric.prototype.getJSONProfilingMeta = function getJSONProfilingMeta(){
    if(this.profilingMeta){
        this.profilingMeta.finishTime = (new Date()).getTime();
        this.profilingMeta.startTime = this.profilingMeta.finishTime - 60000;
    }
    return this.profilingMeta;
}

Metric.prototype.getHttpReq = function getHttpReq()  {

    var xmlString = '<socketData subnode="' + this.originNode + '">' +
                    '<attrGroup name="HTTPReq">';
    var requests = this.requests;
    var key;
    var isEmpty = true;

    for( key in requests )  {
        var request = requests[key];
        if( typeof request !== 'object' )  {
            continue;
        }
        var xmlRow = '  <in>' +
                     '    <a v="' + request.reqUrl + '"/>' + 
                     '    <a v="' + request.method + '"/>' +
                     '    <a v="' + request.averageResponseTime + '"/>' +
                     '    <a v="' + request.hitCount + '"/>' +
                     '  </in>';
        xmlString += xmlRow;
        isEmpty = false;
    }

    if( isEmpty )  {
        var xmlRow = '  <in>' +
                     '    <a v="N/A"/>' + 
                     '    <a v="N/A"/>' + 
                     '    <a v="0"/>' +
                     '    <a v="0"/>' +
                     '  </in>';
        xmlString += xmlRow;
    }

    xmlString += '</attrGroup>' +
                 '</socketData>';

    return xmlString;
}

Metric.prototype.getJSONHttpReq = function getJSONHttpReq()  {    
    var requests = this.requests;
    var jsonDataArray = [];

    for ( key in requests )  {
        var request = requests[key];
        if( typeof request !== 'object' )  {
            continue;
        }
        
        var jsonRequestData = {
                URL: request.reqUrl,
                METHOD: request.method,
                REQ_RESP_TIME: request.averageResponseTime,
                HIT_COUNT: request.hitCount
        };
    
        jsonDataArray.push(jsonRequestData);
    }
        
    return jsonDataArray;
};

Metric.prototype.getAppInfo2 = function getAppInfo2()  {

    var xmlString = '<socketData subnode="' + this.originNode + '">' +
                    '<attrGroup name="AppInfo2">' + 
                    '  <in>' +
                    '    <a v="' + this.socketio_averageResponseTime + '"/>' + 
                    '    <a v="' + this.socketio_maxRespTime + '"/>' +
                    '    <a v="' + this.socketio_requestRate + '"/>' +
                    '    <a v="' + this.mysql_averageResponseTime + '"/>' + 
                    '    <a v="' + this.mysql_maxRespTime + '"/>' +
                    '    <a v="' + this.mysql_requestRate + '"/>' +
                    '    <a v="' + this.mongo_averageResponseTime + '"/>' + 
                    '    <a v="' + this.mongo_maxRespTime + '"/>' +
                    '    <a v="' + this.mongo_requestRate + '"/>' +
                    '    <a v="' + this.mqtt_averageResponseTime + '"/>' + 
                    '    <a v="' + this.mqtt_maxRespTime + '"/>' +
                    '    <a v="' + this.mqtt_requestRate + '"/>' +
                    '    <a v="' + this.mqlight_averageResponseTime + '"/>' + 
                    '    <a v="' + this.mqlight_maxRespTime + '"/>' +
                    '    <a v="' + this.mqlight_requestRate + '"/>' +
                    '    <a v="' + this.leveldb_averageResponseTime + '"/>' + 
                    '    <a v="' + this.leveldb_maxRespTime + '"/>' +
                    '    <a v="' + this.leveldb_requestRate + '"/>' +
                    '    <a v="' + this.redis_averageResponseTime + '"/>' + 
                    '    <a v="' + this.redis_maxRespTime + '"/>' +
                    '    <a v="' + this.redis_requestRate + '"/>' +
                    '    <a v="' + this.riak_averageResponseTime + '"/>' + 
                    '    <a v="' + this.riak_maxRespTime + '"/>' +
                    '    <a v="' + this.riak_requestRate + '"/>' +
                    '    <a v="' + this.memcached_averageResponseTime + '"/>' + 
                    '    <a v="' + this.memcached_maxRespTime + '"/>' +
                    '    <a v="' + this.memcached_requestRate + '"/>' +
                    '    <a v="' + this.oracledb_averageResponseTime + '"/>' + 
                    '    <a v="' + this.oracledb_maxRespTime + '"/>' +
                    '    <a v="' + this.oracledb_requestRate + '"/>' +
                    '    <a v="' + this.oracle_averageResponseTime + '"/>' + 
                    '    <a v="' + this.oracle_maxRespTime + '"/>' +
                    '    <a v="' + this.oracle_requestRate + '"/>' +
                    '    <a v="' + this.strongoracle_averageResponseTime + '"/>' + 
                    '    <a v="' + this.strongoracle_maxRespTime + '"/>' +
                    '    <a v="' + this.strongoracle_requestRate + '"/>' +
                    '    <a v="' + this.postgresql_averageResponseTime + '"/>' + 
                    '    <a v="' + this.postgresql_maxRespTime + '"/>' +
                    '    <a v="' + this.postgresql_requestRate + '"/>' +
                    '  </in>' +
                    '</attrGroup>' +
                    '</socketData>';
    return xmlString;
}

Metric.prototype.getJSONAppInfo2 = function getJSONAppInfo2()  {    
    var jsonData = {
            SOCKETIO_REQRATE: this.socketio_requestRate,
            SOCKETIO_RESP_TIME: this.socketio_averageResponseTime,
            SOCKETIO_MAX_RSPTIME: this.socketio_maxRespTime,
            MYSQL_REQRATE: this.mysql_requestRate,
            MYSQL_RESP_TIME: this.mysql_averageResponseTime,
            MYSQL_MAX_RSPTIME: this.mysql_maxRespTime,
            MONGO_REQRATE: this.mongo_requestRate,
            MONGO_RESP_TIME: this.mongo_averageResponseTime,
            MONGO_MAX_RSPTIME: this.mongo_maxRespTime,
            MQTT_REQRATE: this.mqtt_requestRate,
            MQTT_RESP_TIME: this.mqtt_averageResponseTime,
            MQTT_MAX_RSPTIME: this.mqtt_maxRespTime,
            MQLIGHT_REQRATE: this.mqlight_requestRate,
            MQLIGHT_RESP_TIME: this.mqlight_averageResponseTime,
            MQLIGHT_MAX_RSPTIME: this.mqlight_maxRespTime,
            LEVELDB_REQRATE: this.leveldb_requestRate,
            LEVELDB_RESP_TIME: this.leveldb_averageResponseTime,
            LEVELDB_MAX_RSPTIME: this.leveldb_maxRespTime,
            REDIS_REQRATE: this.redis_requestRate,
            REDIS_RESP_TIME: this.redis_averageResponseTime,
            REDIS_MAX_RSPTIME: this.redis_maxRespTime,
            RIAK_REQRATE: this.riak_requestRate,
            RIAK_RESP_TIME: this.riak_averageResponseTime,
            RIAK_MAX_RSPTIME: this.riak_maxRespTime,
            MEMCACHED_REQRATE: this.memcached_requestRate,
            MEMCACHED_RESP_TIME: this.memcached_averageResponseTime,
            MEMCACHED_MAX_RSPTIME: this.memcached_maxRespTime,
            ORACLEDB_REQRATE: this.oracledb_requestRate,
            ORACLEDB_RESP_TIME: this.oracledb_averageResponseTime,
            ORACLEDB_MAX_RSPTIME: this.oracledb_maxRespTime,
            ORACLE_REQRATE: this.oracle_requestRate,
            ORACLE_RESP_TIME: this.oracle_averageResponseTime,
            ORACLE_MAX_RSPTIME: this.oracle_maxRespTime,
            STRONGORACLE_REQRATE: this.strongoracle_requestRate,
            STRONGORACLE_RESP_TIME: this.strongoracle_averageResponseTime,
            STRONGORACLE_MAX_RSPTIME: this.strongoracle_maxRespTime,
            POSTGRESQL_REQRATE: this.postgresql_requestRate,
            POSTGRESQL_RESP_TIME: this.postgresql_averageResponseTime,
            POSTGRESQL_MAX_RSPTIME: this.postgresql_maxRespTime
    };

    return jsonData;
};


module.exports = Metric;
