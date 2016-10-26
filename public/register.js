var confirmForm = function(){
	var username = document.getElementById("username");
	var password = document.getElementById("password");
	var confirm  = document.getElementById("confirm_password");

	if(password.value != confirm.value){
		alert("Passwords do not match!");
		password.value = "";
		confirm.value  = "";
		return false;
	}

	password.value = sha256(password.value);

	return true;
};
