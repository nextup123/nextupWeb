// Subscribing to /current_position_velocity topic to display position and velocity
var jointValues = new ROSLIB.Topic({
    ros: ros,
    name: '/joint_values',
    messageType: 'std_msgs/Float64MultiArray'
});

var cartesianValues = new ROSLIB.Topic({
    ros: ros,
    name: '/cartesian_values',
    messageType: 'std_msgs/Float64MultiArray'
});

// Function to update the display with the current position and velocity
jointValues.subscribe(function(message) {
    var j1val = message.data[0];
    var j2val = message.data[1];
    var j3val = message.data[2];
    var j4val = message.data[3];
    var j5val = message.data[4];
    var j6val = message.data[5];

    document.getElementById('j1val').innerHTML = j1val.toFixed(2) + "°";
    document.getElementById('j2val').innerHTML = j2val.toFixed(2) + "°";
    document.getElementById('j3val').innerHTML = j3val.toFixed(2) + "°";
    document.getElementById('j4val').innerHTML = j4val.toFixed(2) + "°";
    document.getElementById('j5val').innerHTML = j5val.toFixed(2) + "°";
    document.getElementById('j6val').innerHTML = j6val.toFixed(2) + "°";    
});

cartesianValues.subscribe(function(message) {
    var xval = message.data[0];
    var yval = message.data[1];
    var zval = message.data[2];
    var rval = message.data[3];
    var pval = message.data[4];
    var wval = message.data[5];

    document.getElementById('xval').innerHTML = xval.toFixed(2) + "cm";
    document.getElementById('yval').innerHTML = yval.toFixed(2) + "cm";
    document.getElementById('zval').innerHTML = zval.toFixed(2) + "cm";
    document.getElementById('rval').innerHTML = rval.toFixed(2) + "°";
    document.getElementById('pval').innerHTML = pval.toFixed(2) + "°";
    document.getElementById('wval').innerHTML = wval.toFixed(2) + "°";    
});
