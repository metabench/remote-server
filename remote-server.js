/**
 * Created by James on 12/09/2016.
 */

// Designed for CentOS 7

var Client = require('ssh2').Client;
var column_parser = require('node-column-parser');

var arrayify_object_list = function(object_list) {
	// get the order of the headers from the first object ???

	var res = [];

	var object = object_list[0];
	var res2 = [];
	var index;

	for(index in object) {
		//var attr = object[index];
		res2.push(index);

	}
	res.push(res2);

	for (var c = 0, len = object_list.length; c < len; c++) {
		//someFn(arr[i]);
		object = object_list[c];
		res2 = [];
		for(index in object) {
			//var attr = object[index];
			res2.push(object[index]);

		}
		res.push(res2);
	}
	return res;
}

var filter_string_lines_matching = (string, regex) => {
	var lines = string.split(/\r?\n/);
	var res_lines = [];

	lines.forEach((v) => {
		if (!v.match(regex)) {
			res_lines.push(v);
		}
	});

	return res_lines.join('\n');

}

var mapify_arr_kvs = (arr_kvs) => {
	var res = {};
	arr_kvs.forEach((v) => {
		res[v[0]] = v[1];
	});
	return res;
}

var proc_stat_diff = (stat1, stat2) => {
	var res = {};

	if (stat1.cpus.length === stat2.cpus.length) {
		// Amalgamated CPUs
		var l = stat1.amalgamated_cpu.length - 1;
		//console.log('stat1.amalgamated_cpu', stat1.amalgamated_cpu);
		var res_amalgamated_cpu = new Array(l);
		var c, d;

		for (d = 1; d <= l; d++) {
			res_amalgamated_cpu[d - 1] = stat2.amalgamated_cpu[d] - stat1.amalgamated_cpu[d];
			//console.log('res_amalgamated_cpu[d - 1]', res_amalgamated_cpu[d - 1]);
		}


		var count_cpus = stat1.cpus.length;
		var res_cpus = [];



		for (c = 0; c < count_cpus; c++) {
			l = stat1.cpus[0].length - 1;

			var res_cpu = new Array(l);
			for (d = 1; d < l; d++) {
				res_cpu[d - 1] = stat2.cpus[c][d] - stat1.cpus[c][d];
			}
			res_cpus.push(res_cpu);




		}
		res.amalgamated_cpu = res_amalgamated_cpu;
		res.cpus = res_cpus;
	}

	return res;


}


// This could also install things with YUM.
//  Prior to using routes, it would need to install net-tools if routes is not available.


// Mixin type code could work well, where there are more specific server roles that get composed using other code.
//  Eg, will need to use Remote_Node_Server in a few cases to get node functionality.
//  Setting up node functionality could be within that module, and made available as a static function, or done through prototype access and extension that way.


class Remote_Server {
	constructor(host, user, pass, port = 22) {
		this.host = host;
		this.user = user;
		this.pass = pass;
		this.port = port;
		this.connected = false;
		this.conn = new Client();

		// recent collection of installed yum modules?
		// or it looks for specific tools when it starts?
		// or it gets the whole load of yum modules?


	}
	ensure_connected(callback) {
		if(!this.connected) {
			this.connect(callback);
		} else {
			callback(null, this.conn);
		}
	}
	connect(callback) {
		var that = this;
		this.conn.once('ready', () => {
			//console.log('Client :: ready');
			that.connected = true;

			callback(null, that.conn);
		}).connect({
			'host': this.host,
			'port': this.port,
			'username': this.user,
			'password': this.pass
		})
	}
	disconnect() {
		this.conn.end();
		this.connected = false;
	}

	// Should download as binary?
	//  Strings for the moment.
	download(path, callback) {
		var that = this;
		var use_compression = {encoding: 'utf8'};

		that.ensure_connected((err, connected) => {
			that.conn.sftp((err, sftp) => {
				//console.log('path', path);
				var stream = sftp.createReadStream(path, use_compression);
				var string = '';


				stream.on('data', function(buffer) {
					var part = buffer.toString();
					string += part;
					//console.log('stream data ' + part);
				});


				stream.on('end',function(){
					//console.log('final output ' + string);
					callback(null, string);
				});
			})
		});
		//var stream = this.conn.
	}

	upload(text, path, callback) {
		var that = this;

		that.ensure_connected((err, connected) => {
			that.conn.sftp((err, sftp) => {
				//console.log('path', path);
				var stream = sftp.createWriteStream(path);
				stream.write(text);

				stream.on('finish', function () {
					console.log('file has been written');
					callback(null, true);
				});
			})
		});
	}


	// Remove bash_profile lines matching

	remove_bash_profile_lines_matching(regex, callback) {
		var that = this;

		that.get_bash_profile((err, bash_profile) => {
			if (err) { callback(err); } else {
				//console.log('bash_profile', bash_profile);

				var filtered_bash_profile = filter_string_lines_matching(bash_profile, regex);

				//console.log('filtered_bash_profile', filtered_bash_profile);

				that.set_bash_profile(filtered_bash_profile, (err, res_set) => {
					if (err) {
						callback(err);
					} else {
						//console.log('res_set', res_set);

						callback(null, true);
					}
				});
			}
		})
	}

	// yum_prereq_bash_command(requirement(s), command, callback)
	//  so it could require that net-tools is installed before doing route
	//  can check the prereq against the map of installed tools to get started.



	bash_command_requiring_yum_module(module, command, callback) {
		var that = this;
		that.ensure_yum_module(module, (err, res_module) => {
			if (err) { callback(err) } else {
				that.bash_command(command, callback);
			}
		})

	}

	bash_command(command, callback) {
		var that = this;
		this.ensure_connected((err, conn) => {
			//this.conn.exec(command, function(err, stream) {
			if (err) throw err;
			var res = '';

			conn.exec(command, (err, stream) => {
				stream.on('close', (code, signal) => {
					//console.log('stream closed');

					//console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
					//conn.end();
					//that.connected = false;

					callback(null, res);
				}).on('data', (data) => {
					res = res + data;
					//console.log('STDOUT: ' + data);
				}).stderr.on('data', (data) => {
					//console.log('STDERR: ' + data);
					callback(data);
				});
			});
		});
	}

	processes(callback) {
		this.bash_command('ps aux', (err, res_ps_aux) => {
			if (err) {
				callback(err);
			} else {
				//console.log('', res_ps_aux);
				// then reformat it into an array

				var rows = column_parser(res_ps_aux);
				callback(null, arrayify_object_list(rows));
			}
		});
	}

	find_matching_directories_from_root(str_match, callback) {
		//console.log('find_matching_directories_from_root');
		this.bash_command('find / -type d -name "*' + str_match + '*" -print', function(err, matching) {
			if (err) {
				callback(err);
			} else {
				//console.log('matching', matching);
				var res = matching.trim().split(/\r?\n/);
				// then reformat it into an array
				//var rows = column_parser(res_ps_aux);
				callback(null, res);
			}
		});
	}

	// Want to work out if a machine is

	// ?????? - Mostly free with spare capacity
	//        - Somewhat busy so restrain the process slightly (maybe 60% total)
	//        - Busy enough so that we should restrain the new work a lot, like only using 1 or 2 threads

	// idle to mostly-idle     ] Safety zone
	// somewhat-busy           ]                   ] Efficiency zone
	// very-busy               .                   ]
	// overloaded

	// Activity levels



	get_cat_proc_stat_diff(delay, callback) {
		var that = this;

		var t1 = new Date().getTime();

		that.get_cat_proc_stat((err, stat1) => {
			if (err) { callback(err) } else {

				var t2 = new Date().getTime();

				var roundtrip_time = t2 - t1;

				//console.log('roundtrip_time', roundtrip_time);

				//console.log('stat1', stat1);

				var delay2 = delay - roundtrip_time / 3;
				if (delay2 < 0) delay2 = 0;

				//var delay = 1000;

				setTimeout(() => {

					that.get_cat_proc_stat((err, stat2) => {
						if (err) { callback(err) } else {

							//var t3 = new Date().getTime();

							//var roundtrip_time_2 = t3 - t2;

							//console.log('roundtrip_time_2', roundtrip_time_2);

							//console.log('stat2', stat2);

							var stat_diff = proc_stat_diff(stat1, stat2);
							//console.log('stat_diff', stat_diff);

							callback(null, stat_diff);

							/*
							 user: normal processes executing in user mode
							 nice: niced processes executing in user mode
							 system: processes executing in kernel mode
							 idle: twiddling thumbs
							 iowait: waiting for I/O to complete
							 irq: servicing interrupts
							 softirq: servicing softirqs
							 */




						}
					});



				}, delay2);



			}
		});

	}

	get_cat_proc_stat_1s_diff(callback) {
		this.get_cat_proc_stat_diff(1000, callback);
	}

	get_cpu_timed_amalgamated_proportion_nonidle_core_count(delay, callback) {
		// proportion between 0 and 1

		var that = this;
		that.get_cat_proc_stat_diff(delay, (err, stat_diff) => {
			if (err) {
				callback(err);
			} else {
				var arr_amalgamated = stat_diff.amalgamated_cpu;

				//console.log('arr_amalgamated', arr_amalgamated);
				//console.log('arr_amalgamated.length', arr_amalgamated.length);

				var working = 0, idle = 0, l = arr_amalgamated.length;

				for (var c = 0; c < l; c++) {
					//console.log('typeof arr_amalgamated[c]', typeof arr_amalgamated[c]);

					if (c === 3) {
						idle += arr_amalgamated[c];
					} else {
						working += arr_amalgamated[c];
					}
				}

				var total = working + idle;

				var prop_working = working / total;
				//var res = [prop_working, stat_diff.cpus.length];
				var res = {
					'proportion_not_idle': prop_working,
					'cpu_core_count': stat_diff.cpus.length
				}

				callback(null, res);
			}
		})
	}


	get_proc_meminfo(callback) {
		this.cat_get_file('/proc/meminfo', (err, str_meminfo) => {
			//var rows = column_parser(str_cpuinfo);
			//console.log('rows', rows);

			//console.log('str_stat', str_stat);

			//console.log('str_meminfo', str_meminfo);


			// will format it with [value, unit] though all are kB so far

			var lines_meminfo = str_meminfo.trim().split(/\r?\n/);

			//console.log('lines_meminfo', lines_meminfo);

			var res = {};

			lines_meminfo.forEach((v) => {
				var s_line = v.split(':');

				s_line[1] = s_line[1].trim().split(' ');
				s_line[1][0] = parseInt(s_line[1][0]);

				res[s_line[0]] = s_line[1];


				//console.log('s_line', s_line);
			})

			callback(null, res);
		});
	}

	// Get number of cores and overall utilization over 1s.

	get_cat_proc_stat(callback) {
		this.cat_get_file('/proc/stat', (err, str_stat) => {
			//var rows = column_parser(str_cpuinfo);
			//console.log('rows', rows);

			//console.log('str_stat', str_stat);

			var stat_lines = str_stat.split('\n');
			// read the lines into CPU lines, and other lines.
			var amalgamated_cpus_line;
			var cpu_lines = [];
			var other_lines = [];
			var saved_as_cpu;

			//console.log('stat_lines', stat_lines);

			stat_lines.forEach((v, i) => {
				var split_line = v.replace(/\s+/g, ' ').split(' ');
				saved_as_cpu = false;

				//console.log('split_line.length', split_line.length);

				if (split_line.length === 9) {
					//split_line[0] = split_line[0].trim();
					if (split_line[0].indexOf('cpu') === 0) {
						if (split_line[0].length > 3) {
							//console.log('split_line', split_line);


							cpu_lines.push(split_line);
						} else {
							amalgamated_cpus_line = split_line;
						}
						saved_as_cpu = true;
					}
				}
				if (!saved_as_cpu) {
					if (split_line.length > 1) {
						//console.log('split_line', split_line);
						other_lines.push(split_line);
					}
				}
			});

			var res = {
				'amalgamated_cpu': amalgamated_cpus_line,
				'cpus': cpu_lines,
				'other': other_lines
			};

			callback(null, res);
		});
	}

	get_cpuinfo(callback) {
		this.cat_get_file('/proc/cpuinfo', (err, str_cpuinfo) => {
			//var rows = column_parser(str_cpuinfo);
			//console.log('rows', rows);

			//console.log('str_cpuinfo', str_cpuinfo);

			var str_arr_cpus = str_cpuinfo.trim().split('\n\n');
			//console.log('str_arr_cpus.length', str_arr_cpus.length);

			var res_cpus = [];

			str_arr_cpus.forEach((v) => {
				var cpu_lines = v.split('\n');
				var cpu_kvs = [];
				cpu_lines.forEach((v) => {
					var cpu_kv = v.split(': ');

					if (cpu_kv.length === 2) {
						//console.log('cpu_kv.length', cpu_kv.length);

						cpu_kv[0] = cpu_kv[0].trim();

						// Then we can parse the value

						if (cpu_kv[1] === 'yes') cpu_kv[1] = true;
						if (cpu_kv[1] === 'no') cpu_kv[1] = false;

						var num_v = +cpu_kv[1];
						//console.log('num_v', num_v);
						//console.log('typeof num_v', typeof num_v);

						if (isNaN(num_v)) {

						} else {
							cpu_kv[1] = num_v;
						}
					}

					cpu_kvs.push(cpu_kv);
				})
				//console.log('cpu_kvs', cpu_kvs);

				var map_cpu = mapify_arr_kvs(cpu_kvs);


				//console.log('map_cpu', map_cpu);

				res_cpus.push(map_cpu);


				// mapify_arr_kvs

				//console.log('cpu_lines', cpu_lines);
			});

			//console.log('res_cpus', res_cpus);

			callback(null, res_cpus);

		});
	}

	// get the proc stat
	// two readings, 1s apart, and we can calculate things

	// proc stat timed diff

	// A reading of how unidle the processors have been in the last second will be useful.













	get_general_performance_capabilities(callback) {
		// nproc = number of cpus / available CPU threaded units
		// cat /proc/meminfo
		//  detailed memory usage
		// cat /proc/cpuinfo
		//  detailed CPU info

	}


	// build and install from source.
	//  needs yum: gcc gcc-c++

	// Find out the latest node version...?
	//  Or be given the node version on init.
	//  Will be in a different piece of code

	download_build_install(url, callback) {
		// Want to find out how many CPUs are available.
		//  How much work the CPUs are doing too. Don't want to tax the system too much.
		//  Can use 1 thread if CPUs are generally busy.
		//  Generally will try to make use of available resources.

		// get general performance profile (capabilities, benchmarks under best conditions?)
		//  number of CPUs available, amount of RAM total

		// get_general_performance_capabilities

		// get very recent performance profile
		// get immediate performance profile

		// Can make some heuristics to know when to use many threads and when not to.

	}

	cat_get_file(path, callback) {
		this.bash_command('cat ' + path, function(err, str_file) {
			if (err) {
				callback(err);
			} else {
				//console.log('matching', matching);
				//var res = matching.trim().split(/\r?\n/);
				// then reformat it into an array
				//var rows = column_parser(res_ps_aux);
				callback(null, str_file);
			}
		});
	}

	// cat ~/.bash_profile
	get_bash_profile(callback) {
		// ~/.bash_profile
		this.cat_get_file('~/.bash_profile', callback);
	}

	set_bash_profile(bash_profile, callback) {

		this.echo_overwrite_file(bash_profile, '.bash_profile', function(err, profile) {
			if (err) {
				callback(err);
			} else {
				//console.log('matching', matching);
				//var res = matching.trim().split(/\r?\n/);
				// then reformat it into an array
				//var rows = column_parser(res_ps_aux);
				callback(null, true);
			}
		});
	}

	// And can use echo to write a bash profile.
	//  That seems more reliable, because the SFTP server does not handle aliases.

	// Problems with quotes and how to escape them...

	echo_overwrite_file(text, path, callback) {

		var command = 'echo "' + text.split('"').join('\\"') + '" > \'' + path + '\'';

		//console.log('command', command);
		this.bash_command(command, function(err, res) {
			if (err) {
				callback(err);
			} else {
				//console.log('res', res);
				//var res = matching.trim().split(/\r?\n/);
				// then reformat it into an array
				//var rows = column_parser(res_ps_aux);
				callback(null, res);
			}
		});
	}

	delete_directories(directories, callback) {
		var command = 'rm -rf ' + directories.join(' ');
		this.bash_command(command, (err, res_command) => {
			if (err) {
				callback(err);
			} else {
				//console.log('matching', matching);
				//var res = matching.trim().split(/\r?\n/);
				// then reformat it into an array
				//var rows = column_parser(res_ps_aux);
				callback(null, true);
			}
		});
	}

	whereis(name, callback) {
		this.bash_command('whereis ' + name, (err, matching) => {
			if (err) {
				callback(err);
			} else {
				matching = matching.trim();
				var pos1 = matching.indexOf(':', 0);
				var str_items = matching.substr(pos1 + 1).trim();
				var items = str_items.split(' ');
				callback(null, items);
			}
		});
	}

	yum_list_installed(callback) {
		//console.log('yum_list_installed');
		this.bash_command('yum list installed', (err, installed) => {
			if (err) {
				callback(err);
			} else {
				var lines_installed = installed.trim().split(/\r?\n/).slice(2);
				var res = [];

				lines_installed.forEach((v) => {
					res.push(v.replace(/\s+/g, ' ').trim().split(' '));
				});

				callback(null, res);
			}
		});
	}

	yum_map_installed(callback) {
		var that = this;
		var name, arch, ver, status;

		if (that._yum_map_installed) {
			callback(null, this._yum_map_installed);
		} else {
			that.yum_list_installed(function(err, yum_list) {
				if (err) {
					callback(err);
				} else {
					that._yum_map_installed = {};
					yum_list.forEach(function(v) {
						[name, arch] = v[0].split('.');
						//var name = s0[0];
						ver = v[1];
						status = v[2];
						that._yum_map_installed[name] = [arch, ver, status];
					});
					callback(null, that._yum_map_installed);
				}
			})
		}
	}

	// yum module info

	yum_module_info(name, callback) {
		var that = this;
		that.yum_map_installed(function(err, yum_map_installed) {
			if (err) {
				callback(err);
			} else {
				//console.log('yum_map_installed', yum_map_installed);
				callback(null, yum_map_installed[name]);
			}
		})
	}

	has_yum_module(name, callback) {
		var that = this;
		that.yum_module_info(name, function(err, info) {
			if (err) {
				callback(err);
			} else {
				//console.log('yum_map_installed', yum_map_installed);
				callback(null, !!info);
			}
		})
	}

	ensure_yum_module(name, callback) {
		var that = this;
		that.has_yum_module(name, function(err, has) {
			if (err) {
				callback(err);
			} else {
				//console.log('yum_map_installed', yum_map_installed);

				if (!has) {
					that.install_yum_module(name, callback);
				} else {
					callback(null, has);
				}

				//callback(null, !!info);
			}
		})
	}

	install_yum_module(name, callback) {
		this.bash_command('yum install ' + name + ' -y', function(err, res_install) {
			if (err) {
				callback(err);
			} else {
				//console.log('res_install', res_install);
				// can look at the version info, and save details in the yum module map.

				//var lines_installed = installed.trim().split(/\r?\n/).slice(2);
				//var res = [];

				//lines_installed.forEach(function(v) {
				//	res.push(v.replace(/\s+/g, ' ').trim().split(' '));
				//});
				callback(null, true);
			}
		});
	}

	// route...

	get_kernel_ip_routing_table(callback) {
		var that = this;
		that.bash_command_requiring_yum_module('net-tools', 'route', function(err, res_command) {
			if (err) { callback(err); } else {
				//console.log('res_command', res_command);
				var lines_res = res_command.trim().split(/\r?\n/).slice(1);
				var res = [];

				lines_res.forEach(function(v, i) {
					res.push(v.replace(/\s+/g, ' ').split(' '));
				});

				callback(null, res);
			}
		})
	}

	failed_login_attempts(callback) {

		// requires which.

		var that = this;

		that.bash_command_requiring_yum_module('which', 'journalctl `which sshd` -a --no-pager | grep Failed', function(err, res_command) {
			if (err) { callback(err); } else {
				//console.log('res_command', res_command);
				var lines_res = res_command.trim().split(/\r?\n/);
				callback(null, lines_res);
			}
		})
	}

	get_all_shell_variables(callback) {
		this.bash_command('set', (err, res_command) => {
			if (err) {
				callback(err);
			} else {

				//console.log('res_command', res_command);
				// can look at the version info, and save details in the yum module map.


				//var lines_installed = installed.trim().split(/\r?\n/).slice(2);
				//var res = [];

				//lines_installed.forEach(function(v) {
				//	res.push(v.replace(/\s+/g, ' ').trim().split(' '));
				//});

				callback(null, true);
			}
		});
	}

	// Multi-line bash commands?
	// Seems easy enough I think.

	get_shell_function_names(callback) {
		this.bash_command('declare -F', (err, res_command) => {
			if (err) {
				callback(err);
			} else {

				//console.log('res_command', res_command);
				var res = [];

				res_command.trim().split(/\r?\n/).forEach((v) => {
					// 'declare -f '.length
					res.push(v.substr(11));
				});
				// can look at the version info, and save details in the yum module map.

				//var lines_installed = installed.trim().split(/\r?\n/).slice(2);
				//var res = [];

				//lines_installed.forEach(function(v) {
				//	res.push(v.replace(/\s+/g, ' ').trim().split(' '));
				//});

				callback(null, res);
			}
		});
	}

	get_shell_function_names_matching(regex, callback) {
		var that = this;
		that.get_shell_function_names((err, names) => {
			if (err) {
				callback(err);
			} else {

				var filtered = names.filter((item) => {
					return regex.test(item);
				});

				callback(null, filtered);

			}
		})
	}

	delete_shell_functions(shell_functions, callback) {
		var command = 'unset -f';

		//var first = true;

		shell_functions.forEach((v) => {
			//if (!first) {
				//command = command + '\n';
			//} else {
			//	first = false;
			//}
			command = command + ' ' + v;
		});

		console.log('command', command);

		this.bash_command(command, (err, res_command) => {
			if (err) {
				callback(err);
			} else {
				console.log('res_command', res_command);
				//});
				callback(null, true);
			}
		});

	}

	delete_shell_functions_matching(regex, callback) {
		var that = this;
		that.get_shell_function_names_matching(regex, (err, matching) => {
			console.log('matching', matching);
			if (err) { callback(err) } else {
				that.delete_shell_functions(matching, callback);
			}
		});
	}

	// A map of installed (yum) modules would be useful, so it can be checked if something is installed before trying to execute a command.
	//  Can use a required() function (required ('net-tools', 'route'))
	//  So we have it check what is installed, and install the necessary tool(s) through yum if it is not there.

}


module.exports = Remote_Server;