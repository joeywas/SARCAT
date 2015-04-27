var mapDrawn;
var drawn;
Template.records.onCreated(function (a) {
    Tracker.autorun(function () {
        var count = Records.find()
            .count()
        Session.set('count', count);
    });
})
Template.records.onRendered(function () {
    x = this
    drawn = false;
    if (Records.find()
        .count()) {
        $('.recordTable').bootstrapTable();
    }
    Session.set('userView', 'records');
    var config = Config.findOne();
    var agencyProfile = config.agencyProfile;
    var bounds = config.bounds;
    var newBounds = boundsString2Array(bounds);
    mapDrawn = newProjectSetMap('recordMap', newBounds, {
        "name": "coords.ippCoordinates",
        "text": "Incident Location"
    });
    $('#createRecordModal')
        .on('shown.bs.modal', function (e) {
            var lastRecord = Records.find({}, {
                    sort: {
                        created: -1
                    },
                })
                .fetch();
            $('[name="recordInfo.name"]')
                .val('Record ' + (lastRecord.length + 1));
            if (lastRecord.length) {
                var lastIncidentnum = _.find(lastRecord, function (d) {
                        if (d.recordInfo && d.recordInfo.incidentnum) {
                            return d.recordInfo.incidentnum;
                        }
                    })
                    .recordInfo.incidentnum;
                var lastMissionnum = _.find(lastRecord, function (d) {
                        if (d.recordInfo && d.recordInfo.missionnum) {
                            return d.recordInfo.missionnum;
                        }
                    })
                    .recordInfo.missionnum;
                var lastleadagency = _.find(lastRecord, function (d) {
                    if (d.recordInfo && d.recordInfo.leadagency) {
                        return d.recordInfo.leadagency;
                    }
                });
                lastleadagency = (lastleadagency) ? lastleadagency.recordInfo.leadagency : null;
                $('[name="recordInfo.incidentnum"]')
                    .attr('placeholder', 'Previous Incident: ' + lastIncidentnum);
                $('[name="recordInfo.missionnum"]')
                    .attr('placeholder', 'Previous Mission: ' + lastMissionnum);
                $('[name="recordInfo.leadagency"]')
                    .attr('value', lastleadagency)
                    .trigger('change');
            } else {
                $('[name="recordInfo.incidentnum"]')
                    .attr('value', Records.defaultNum())
                    .trigger('change');
                $('[name="recordInfo.missionnum"]')
                    .attr('value', Records.defaultNum())
                    .trigger('change');
                $('[name="recordInfo.leadagency"]')
                    .attr('value', lastleadagency)
                    .trigger('change');
            }
            mapDrawn.reset();
        });
});
Template.records.helpers({
    allRecords: function () {
        return this.records;
    },
    isAdmin: function () {
        return Roles.userIsInRole(Meteor.userId(), ['admin']);
    },
    noRecords: function () {
        return !Records.find({}, {
                sort: {
                    name: 1
                }
            })
            .fetch()
            .length;
    },
    newRecord: function () {
        return Records.findOne(Session.get('newRecord'));
    },
    createNewBtn: function () {
        var config = Session.get('config');
        var profile = _.compact(_.map(config.agencyProfile, function (d) {
                return d;
            }))
            .length;
        var role = Roles.userIsInRole(Meteor.userId(), ['admin', 'editor']);
        return profile && role;
    },
    toDateString: function (date) {
        if (!date || typeof (date) !== 'object') {
            return;
        }
        return date.toISOString()
            .split('T')[0];
    },
    selectedRecords: function () {
        //console.log(checked = $('.bs-checkbox [name="btSelectItem"]:checked')[0])
        return Session.get('selectedRecords');
    }
});
Template.records.events({
    'click .js-deleteRecord': function () {
        var record = Records.findOne(Session.get('newRecord'));
        Meteor.call('removeRecord', record, function (error, d) {});
    },
    'click .modal-backdrop': function () {
        var record = Records.findOne(Session.get('newRecord'));
        Meteor.call('removeRecord', record, function (error, d) {
            console.log(error, d)
        })
    },
    'click .recordStats': function (event, template) {
        if (drawn) {
            return;
        }
        drawn = true;
        template.$('a[data-toggle="tab"][href="#recordStats"]')
            .on('shown.bs.tab', function (e) {
                var records = Records.find()
                    .fetch();
                data = recordStats(records);
                var coords = records.map(function (d) {
                    return d.coords
                });
                if (!records.length) {
                    return;
                }
                var mapBounds = coords[0].bounds;
                mapBounds = boundsString2Array(mapBounds);
                map = statsSetMap('statsMap', mapBounds);
                var mapPoints = {
                    "ippCoordinates": {
                        "val": "ippCoordinates",
                        "name": "coords.ippCoordinates",
                        "text": "IPP Location. <br>Direction of Travel (hover to edit): <div class=\"fa fa-arrow-circle-up fa-2x fa-fw travelDirection\"></div>",
                        "icon": "fa-times-circle-o text-black"
                    },
                    /* "decisionPointCoord": {
                         "val": "decisionPointCoord",
                         "name": "coords.decisionPointCoord",
                         "text": "Decision Point",
                         "icon": "fa-code-fork text-danger"
                     },
                     "destinationCoord": {
                         "val": "destinationCoord",
                         "name": "coords.destinationCoord",
                         "text": "Intended Destination",
                         "icon": "fa-bullseye text-default"
                     },
                     "revisedLKP-PLS": {
                         "val": "revisedLKP-PLS",
                         "name": "coords.revisedLKP-PLS",
                         "text": "Revised IPP",
                         "icon": "fa-times-circle-o 4x text-success"
                     },*/
                    "findCoord": {
                        "val": "findCoord",
                        "name": "coords.findCoord",
                        "text": "Find Location",
                        "icon": "fa-male text-success"
                    },
                    "intendedRoute": {
                        "val": "intendedRoute",
                        "name": "coords.intendedRoute",
                        "text": "Intended Route",
                        "path": {
                            "stroke": "#018996"
                        }
                    },
                    "actualRoute": {
                        "val": "actualRoute",
                        "name": "coords.actualRoute",
                        "text": "Actual Route",
                        "path": {
                            "stroke": "#3C763D",
                            "weight": 8
                        }
                    }
                };
                _.each(mapPoints, function (d) {
                    coords.forEach(function (e) {
                        if (!e) {
                            return;
                        }
                        var latlng = e[d.val];
                        if (!latlng) {
                            return
                        };
                        d.coords = latlng;
                        map.add(d);
                    });
                })
                map.fitBounds();
            });
    },
    'click .openRecord': function (event, template) {
        if (event.target.className === 'bs-checkbox') {
            return;
        }
        Router.go('form', {
            _id: event.currentTarget.id
        });
    },
    'click .deleteRecord': function (event, template) {
        var toDelete = $('.bs-checkbox [name="btSelectItem"]:checked')
            .parent()
            .parent()
            .map(function (d) {
                return {
                    id: this.id,
                    name: Records.findOne(this.id)
                        .recordInfo.name
                };
            });
        if (!toDelete.length) {
            return;
        }
        var message = 'Are you sure you want to delete the following records: ' + _.map(toDelete, function (d) {
                return d.name;
            })
            .join(', ');
        if (confirm(message)) {
            toDelete.each(function (e, d) {
                console.log(d)
                Meteor.call('removeRecord', d.id, function (error, d) {});
            });
            Meteor._reload.reload();
            return true;
        } else {
            return false;
        }
    },
    'click .js-newRecord': function (event, template) {
        return;
        var list = {
            userId: Meteor.userId()
        };
        Meteor.call('addRecord', list, function (error, d) {
            if (error) {
                return console.log(error);
            }
            Session.set('newRecord', d);
        });
    },
    'blur [name="coords.ippCoordinates.lat"],[name="coords.ippCoordinates.lng"]': function (event, template) {
        var lat = template.$('[name="coords.ippCoordinates.lat"]')
            .val();
        var lng = template.$('[name="coords.ippCoordinates.lng"]')
            .val();
        if (!lat || !lng) {
            return;
        }
        console.log(lat, lng);
        mapDrawn.editPoint(lat, lng);
    },
    'change .bs-checkbox input,[name="btSelectAll"]': function (event, template) {
        var checked = $('.bs-checkbox [name="btSelectItem"]:checked');
        Session.set('selectedRecords', checked.length)
    },
    'change [name="btSelectAll"]': function (event, template) {
        setTimeout(function () {
            var checked = $('.bs-checkbox [name="btSelectItem"]:checked');
            Session.set('selectedRecords', checked.length)
        }, 100)
    },
    'click #downloadRecords': function (event, template) {
        var flatten = function (x, result, prefix) {
            if (_.isObject(x)) {
                _.each(x, function (v, k) {
                    flatten(v, result, prefix ? prefix + '.' + k : k)
                })
            } else {
                result[prefix] = x
            }
            return result
        }
        var allRecords = Records.find();
        allRecordsFlat = allRecords.map(function (d) {
            return flatten(d, {});
        })
        if (navigator.appName != 'Microsoft Internet Explorer') {
            function JSONToCSVConvertor(JSONData, ReportTitle, ShowLabel) {
                var arrData = typeof JSONData != 'object' ? JSON.parse(JSONData) : JSONData;
                var CSV = '';
                CSV += ReportTitle + '\r\n\n';
                if (ShowLabel) {
                    var row = "";
                    for (var index in arrData[0]) {
                        row += index + ',';
                    }
                    row = row.slice(0, -1);
                    CSV += row + '\r\n';
                }
                for (var i = 0; i < arrData.length; i++) {
                    var row = "";
                    for (var index in arrData[i]) {
                        row += '"' + arrData[i][index] + '",';
                    }
                    row.slice(0, row.length - 1);
                    CSV += row + '\r\n';
                }
                if (CSV == '') {
                    alert("Invalid data");
                    return;
                }
                var fileName = ReportTitle.replace(/ /g, "_");
                var uri = 'data:text/csv;charset=utf-8,' + escape(CSV);
                var link = document.createElement("a");
                link.href = uri;
                link.style = "visibility:hidden";
                link.download = fileName + ".csv";
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
            JSONToCSVConvertor(allRecordsFlat, "SARCAT EXPORT-" + new Date()
                .toLocaleString(), true);
            /*
            //var str = JSON.stringify(flattenedData);
            //window.open('data:application/json;charset=utf-8,' + escape(str));
            var uri = 'data:application/json;charset=utf-8,' + escape(str);
            var link = document.createElement("a");
            link.href = uri;

            link.style = "visibility:hidden";
            link.download = "SARCAT_Records_" + new Date().toLocaleString() + ".csv";

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
*/
        } else {
            //ie
            //var popup = window.open('', 'csv', '');
            //popup.document.body.innerHTML = '<pre>' + str + '</pre>';
        }
    },
});
AutoForm.hooks({
    createRecordModalFormId: {
        beginSubmit: function () {
            // $('.recordTable').bootstrapTable('destroy');
        },
        endSubmit: function () {
            //$('.recordTable').bootstrapTable();
        },
        onSuccess: function (formType, result) {
            //Meteor._reload.reload();
            $('#createRecordModal')
                .modal('hide');
            //$('.recordTable')
            //   .bootstrapTable('destroy');
        },
        // Called when any submit operation fails
        onError: function (formType, error) {
            console.log(error);
        },
    }
});

