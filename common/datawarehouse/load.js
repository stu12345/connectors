"use strict";

const leo = require("leo-sdk");
const ls = leo.streams;
const combine = require("./combine.js");
const async = require("async");
module.exports = function(client, tableConfig, stream, callback) {
	ls.pipe(stream, combine(), ls.through((obj, done) => {
		let tasks = [];
		Object.keys(obj).forEach(t => {
			if (t in tableConfig) {
				tasks.push(done => {
					let config = tableConfig[t];
					let sk = null;
					let nk = [];
					let scds = {
						0: [],
						1: [],
						2: [],
						6: []
					};
					Object.keys(config.structure).forEach(f => {
						let field = config.structure[f];

						if (field == "sk" || field.sk) {
							sk = f;
						} else if (field.nk) {
							nk.push(f);
						} else if (field.scd !== undefined) {
							scds[field.scd].push(f);
						}
					});
					if (tableConfig[t].isDimension) {
						client.importDimension(obj[t].stream, t, sk, nk, scds, done);
					} else {
						client.importFact(obj[t].stream, t, nk, done);
					}
				});
			}
		});

		async.parallelLimit(tasks, 10, (err) => {
			if (err) {
				done(err);
			} else {
				let tasks = [];

				let tableSks = {};
				Object.keys(tableConfig).forEach(t => {
					let config = tableConfig[t];
					Object.keys(config.structure).forEach(f => {
						let field = config.structure[f];
						if (field == "sk" || field.sk) {
							tableSks[t] = f;
						}
					});
				});
				Object.keys(obj).forEach(t => {
					let config = tableConfig[t];
					let sk = null;
					let nk = [];
					let scds = {
						0: [],
						1: [],
						2: [],
						6: []
					};
					let links = [];
					Object.keys(config.structure).forEach(f => {
						let field = config.structure[f];

						if (field == "sk" || field.sk) {
							sk = f;
						} else if (field.nk) {
							nk.push(f);
						} else if (field.scd !== undefined) {
							scds[field.scd].push(f);
						}
						if (field.dimension) {
							let link = {};
							if (typeof field.dimension == "string") {
								link = {
									table: field.dimension,
									source: f
								};
							}
							links.push(Object.assign({
								table: null,
								on: f,
								destination: "d_" + f.replace(/_id$/, ''),
								link_date: "_auditdate",
								sk: tableSks[link.table]
							}, link));
						}
					});
					if (links.length) {
						tasks.push(done => client.linkDimensions(t, links, nk, done));
					}
				});

				async.parallelLimit(tasks, 10, (err) => {
					console.log("HERE------------------------------", err);

					done(err);
				});
			}
		});
	}), err => {
		console.log("IN HERE!!!!!!!");
		callback(err, "ALL DONE");
	});
};