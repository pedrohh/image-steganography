var Steganography = require('./steganography.js'),
	DEFAULT_PASSWORD = "3_2Yt65kC:`],8*r9f=bs0sM&pFfw~";

function parseUint8Array(array, length)
{
	var buffer = new Buffer(length);

	for(var i=0; i<length; i++)
	{
 		buffer.writeUInt8(array[i], i);
	}	

	return buffer;
}

function check_default_password(pwd)
{
	return (pwd == null || pwd.length == 0 ? DEFAULT_PASSWORD : pwd);
}

module.exports = function(app) {

	// encrypt image
	app.post("/api/encrypt", function(req, res) {

		var extPointPosition = req.body.img.name.lastIndexOf("."),
			fileImgName = req.body.img.name.substr(0, extPointPosition),
			fileImgExt = req.body.img.name.substr(extPointPosition+1).toLowerCase(),
			fileHideName = req.body.file.name,
			buffer = parseUint8Array(req.body.img.data, req.body.img.length),
			file = parseUint8Array(req.body.file.data, req.body.file.length),
			bits = parseInt(req.body.bits, 10),
			stega = new Steganography();

		stega.init(buffer, "tmp/", fileImgName, fileImgExt, function() {
			stega.parse(function(status) {
				stega.encode(file, fileHideName, bits, check_default_password(req.body.password), function(status, name, contentBase64) {

					if ( status ) res.json({status : "ok", type : "encoded", name : name, content : contentBase64});
					else res.json({status : "error", msg : "ERROR_PARSING"});

					res.end();
				});
			});
		});
	});

	// decrypt image
	app.post("/api/decrypt", function(req, res) {

		var extPointPosition = req.body.img.name.lastIndexOf("."),
			fileImgExt = req.body.img.name.substr(extPointPosition+1),
			buffer = parseUint8Array(req.body.img.data, req.body.img.length),
			stega = new Steganography();

		// Not a valid extension
		if ( fileImgExt != "png" )
		{
			res.json({status : "error", msg : "not a valid extension"});
			res.end();
			return false;
		}

		console.log("Start to decode file...");

		stega.init(buffer, "tmp/", "encoded", "png", function() {
			stega.parse(function() {
				stega.decode(check_default_password(req.body.password), function(status, name, contentBase64) {
					
					if ( status ) res.json({status : "ok", type : "decoded", name : name, content : contentBase64});
					else res.json({status : "error", msg : "ERROR_PARSING"});

					res.end();
				});
			});
		});
	});

};