
var steganographyModule = angular.module('steganographyModule', ['ur.file'])
.config(['$compileProvider', function($compileProvider) {
	$compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|file|data):/);
}]);

function mainController($scope, $http, $interval, $window) 
{
	$scope.status = "";
	$scope.encodedObj = { name: "", content : "", show : false };
	$scope.decodedObj = { name: "", content : "", show : false };

	function onSucess(message)
	{
		if ( message.status != "ok" ) 
		{
			$scope.status = message;
			return false;
		}

		var obj = null;

		if ( message.type == "encoded" ) obj = $scope.encodedObj;
		else obj = $scope.decodedObj;

		obj.show = true;
		obj.name = message.name;
		obj.content = "data:application/octet-stream;base64," + message.content;

		// Show message
		message.content = "base64";
		$scope.status = message;
	}

	function onError(message)
	{
		$scope.status = message;
	}

	// when submitting the add form, send the text to the node API
	$scope.encodeImage = function(encode) {

		if ( encode == null || encode.image == null || encode.file == null ) return false;

		$scope.status = "Uploading file...";
		$scope.encodedObj.show = false;

		var reader = new FileReader();

		reader.readAsArrayBuffer(encode.image);

        reader.onload = function(container) {

        	var imageArray = new Uint8Array(container.target.result);

        	reader.readAsArrayBuffer(encode.file);

        	reader.onload = function(file) {
        		var fileArray = new Uint8Array(file.target.result);

				$http.post('/api/encrypt', { 
						img : { name : encode.image.name, data : imageArray, length : imageArray.length}, 
						file : { name : encode.file.name, data : fileArray, length : fileArray.length},
						bits : isNaN(encode.bits) ? 0 : encode.bits,
						password : (encode.password == null || encode.password.length == 0) ? "" : encode.password
					})
					.success(onSucess)
					.error(onError);
    		};			
        };
	};

	// decrypt
	$scope.decodeImage = function(decode) {

		if ( decode == null || decode.image == null ) return false;

		$scope.status = "Uploading file...";
		$scope.decodedObj.show = false;

		var reader = new FileReader();

		reader.readAsArrayBuffer(decode.image);

        reader.onload = function(container) {

        	var imageArray = new Uint8Array(container.target.result);

			$http.post('/api/decrypt', { 
					img : { name : decode.image.name , data : imageArray, length : imageArray.length },
					password : (decode.password == null || decode.password.length == 0) ? "" : decode.password
				})
				.success(onSucess)
				.error(onError);
        };
	};

}

