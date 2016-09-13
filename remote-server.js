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
				console.log('bash_profile', bash_profile);

				var filtered_bash_profile = filter_string_lines_matching(bash_profile, regex);

				console.log('filtered_bash_profile', filtered_bash_profile);

				that.set_bash_profile(filtered_bash_profile, (err, res_set) => {
					if (err) {
						callback(err);
					} else {
						console.log('res_set', res_set);

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
					console.log('stream closed');

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

	// cat ~/.bash_profile
	get_bash_profile(callback) {
		this.bash_command('cat ~/.bash_profile', function(err, profile) {
			if (err) {
				callback(err);
			} else {
				//console.log('matching', matching);
				//var res = matching.trim().split(/\r?\n/);
				// then reformat it into an array
				//var rows = column_parser(res_ps_aux);
				callback(null, profile);
			}
		});
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

		console.log('command', command);
		this.bash_command(command, function(err, res) {
			if (err) {
				callback(err);
			} else {
				console.log('res', res);
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