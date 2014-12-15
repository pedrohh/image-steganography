var fs = require('fs'), 
	gm = require('gm'),
	imageMagick = gm.subClass({ imageMagick: true }),
	crypto = require("crypto"),
	SeededShuffle = require('seededshuffle'),
	PNG = require('pngjs').PNG;

var steganography = function() {};
module.exports = steganography;

function encryptBuffer(buffer, password)
{
  var cipher = crypto.createCipher("aes-256-ctr", password);

  return Buffer.concat([cipher.update(buffer), cipher.final()]);
}

function decryptBuffer(buffer, password)
{
  var decipher = crypto.createDecipher("aes-256-ctr", password);

  return Buffer.concat([decipher.update(buffer), decipher.final()]);
}

steganography.prototype.init = function(buffer, dir, fileName, fileExt, callback) 
{
	var self = this;

	// Set global
	this.dir = dir;
	this.timestamp = Date.now();
	this.name = this.timestamp + "-" + fileName;
	this.ext = ".png";
	this.path = dir + this.name + this.ext;
	this.parsed = false;
	this.png = null;

	fs.writeFile(self.dir + self.name + "." + fileExt, buffer, function(err) 
	{
		if ( err )
		{
			console.log("fs error: " + err)
		}
		else
		{
			if ( fileExt != "png" ) return self.convert(self.dir + self.name + "." + fileExt, callback);
			else return callback(true);
		}
	}); 
}

steganography.prototype.parse = function(callback) 
{
	var self = this;

	fs.createReadStream(self.path)
	    .pipe(self.png = new PNG({
			filterType: -1,
			deflateStrategy: 2,
			deflateLevel: 9
	    }))
	    .on('parsed', function() {
	    	self.parsed = true;
	    	fs.unlink(self.path);
	    	console.log("File " + self.path + " parsed..");
	    	return callback(true);
	    })
	    .on('error', function(error) {
	    	console.log("Error pngjs: " + error)
	    	return callback(false);
	    });
}


steganography.prototype.convert = function(src, callback) 
{
	var self = this;

	// Convert image to png
	imageMagick(src).setFormat("png")
		.write(self.path, function(err) 
		{
			// Image ready for manipulation
			if ( err )
			{
				console.log("convert error: " + err);
				return callback(false);
			}
			else
			{
				fs.unlink(src);
				console.log("File " + self.path + " converted..");
				return callback(true);
			}
		});	
}

function bitOperation(data, bit, used)
{
	var m = ~used & 255;

	return (data & m) | (bit & ~m);
}

function suffleArray(bufferLength, seed)
{
	var array = [],
		hash = crypto.createHash('sha256').update(seed).digest('hex');

	// Suffle array with seed
	for(var i=0; i<bufferLength; i++)
	{
		// Ignore alpha
		if ( (i % 4) != 3 ) array.push(i);
	}

	return SeededShuffle.shuffle(array, hash, true);
}


steganography.prototype.encode = function(buffer, fileName, bitsInput, password, callback) 
{
	var currentChannel = 0,
		mask = 1;

	function put_data(container, bytes, msk)
	{
		var currentByte = null;

		if ( !(container instanceof Buffer) )
			container = new Buffer(container);

		//console.log("Container length: " + container.length);

		for(var i=0; i<container.length; i++)
		{
			currentByte = container[i];

			//console.log(currentByte);
			//console.log(typeof currentByte);

			for(var j=0; j<8; j+=bytes)
			{
				// Put in random array positions
				img.data[imgShuffled[currentChannel]] = bitOperation(
					img.data[imgShuffled[currentChannel]], 
					(currentByte >> j) & msk, 
					msk
				);

				currentChannel++;

				// Ignore alpha !!(already ignored in suffleArray())
				//if ( (currentChannel % 4) == 3 ) currentChannel++;
			}
		}
	}

	var self = this,
		img = self.png,
		imgShuffled = suffleArray(img.data.length, password),
		totalPixels = img.height*img.width,
		bufferMetadata = new Buffer(fileName, "utf-8"),
		size = new Buffer(4),
		totalBytesAvailable = (totalPixels * 3) / 8,
		totalBytesNeeded = buffer.length + 4 + 4 + 4 + bufferMetadata.length,
		bytesToUse = bitsInput > 0 ? bitsInput : (totalBytesNeeded > totalBytesAvailable ? Math.ceil(totalBytesNeeded/totalBytesAvailable) : 1);

	// Set mask
	mask = Math.pow(2, bytesToUse) - 1;

	console.log("Bytes available: " + totalBytesAvailable*bytesToUse + " (bytes: " + bytesToUse + " mask: " + mask + ")");
	console.log("Info to hide: " + totalBytesNeeded);

	// Check
	if ( totalBytesNeeded > totalBytesAvailable*bytesToUse || bytesToUse > 8 ) 
	{ 
		console.log("Not enough bits available"); 
		return callback(false);
	}

	// Write bytes used
	size.writeUInt32LE(bytesToUse, 0);
	put_data(encryptBuffer(size, password), 1, 1);

	// Write file metadata
	size.writeUInt32LE(bufferMetadata.length, 0);
	put_data(encryptBuffer(size, password), bytesToUse, mask);
	put_data(encryptBuffer(bufferMetadata, password), bytesToUse, mask);

	// Write buffer
	size.writeUInt32LE(buffer.length, 0);
	put_data(encryptBuffer(size, password), bytesToUse, mask);
	put_data(encryptBuffer(buffer, password), bytesToUse, mask);

	//img.pack().pipe(fs.createWriteStream("public/output/encoded.png"));

	console.log("File encoded.png encoded..");

	// Save to file
	img.pack();

	var chunks = [];

	img.on('data', function(chunk) {
		chunks.push(chunk);
	});

	img.on('end', function() {
		return callback(true, (self.name + self.ext), Buffer.concat(chunks).toString('base64'));
	});

}



steganography.prototype.decode = function(password, callback) 
{
	var img = this.png,
		imgShuffled = suffleArray(img.data.length, password), // unshuffle in this case
		currentChannel = 0;

	function read_data(size, bytes, msk)
	{
		var buffer = new Buffer(size);

		for(var i=0; i<size; i++)
		{
			var b = 0;

			for(var j=0; j<8; j+=bytes)
			{
				// Get array positions from seed
				b |= (img.data[imgShuffled[currentChannel]] & msk) << j;

				currentChannel++;

				// Ignore alpha !!(already ignored in suffleArray())
				//if ( (currentChannel % 4) == 3 ) currentChannel++;
			}			

			buffer[i] = b;
		}

		return buffer;
	}

	// Read fields
	var buffer, bytesToUse = 1, mask = 1, size, fileName, content;

	// Bytes used
	buffer = decryptBuffer(read_data(4, 1, 1), password);
	bytesToUse = buffer.readUInt32LE(0);

	if ( bytesToUse >= 1 && bytesToUse <= 8 )
	{
		mask = Math.pow(2, bytesToUse) - 1;

		console.log("Bytes used to encode: " + bytesToUse + " mask: " + mask);

		// Filename
		buffer = decryptBuffer(read_data(4, bytesToUse, mask), password);
		size = buffer.readUInt32LE(0);
		fileName = decryptBuffer(read_data(size, bytesToUse, mask), password);

		// Content
		buffer = decryptBuffer(read_data(4, bytesToUse, mask), password);
		size = buffer.readUInt32LE(0);
		content = decryptBuffer(read_data(size, bytesToUse, mask), password);

		return callback(true, (Date.now() + "-" + fileName), content.toString('base64'));
	}
	else
	{
		console.log("Error parsing image..");
		return callback(false);
	}
}