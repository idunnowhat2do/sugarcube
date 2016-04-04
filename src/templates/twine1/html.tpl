<!DOCTYPE html>
<html class="init-no-js">
<head>
<meta charset="UTF-8" />
<title>SugarCube</title>
<meta name="viewport" content="width=device-width,initial-scale=1" />
<!--

SugarCube (v'{{BUILD_VERSION_VERSION}}'): A free (gratis and libre) story format, based on TiddlyWiki.

Copyright © 2013–2016 Thomas Michael Edwards <tmedwards@motoslave.net>.
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

-->
<!--

Build Info:
  * "TIME"
  * "VERSION"

-->
<script id="script-libraries" type="text/javascript">
if(document.head&&document.addEventListener&&document.querySelector&&Object.create&&Object.freeze&&JSON){document.documentElement.className="init-loading";
'{{BUILD_LIB_SOURCE}}'
/* User Lib */
"USER_LIB"
}else{document.documentElement.className="init-lacking"}
</script>
'{{BUILD_CSS_SOURCE}}'
</head>
<body>
	<div id="init-screen">
		<p id="init-no-js"><noscript>Apologies! JavaScript is required. Please enable it to continue.</noscript></p>
		<p id="init-lacking">Apologies! You are using an <strong>outdated</strong> browser which lacks required capabilities. Please <a href="http://browsehappy.com/">upgrade your browser</a> to improve your experience.</p>
		<p id="init-loading">Initializing. Please wait&hellip;<br /><progress></progress></p>
	</div>
	<div id="store-area" data-size="STORY_SIZE" hidden>"STORY"</div>
	<script id="script-sugarcube" type="text/javascript">
	/*! SugarCube JS

	SugarCube includes code from TiddlyWiki 1.2.39, which has the following license:
	--------------------------------------------------------------------------------
	TiddlyWiki 1.2.39 by Jeremy Ruston, (jeremy [at] osmosoft [dot] com)

	Published under a BSD open source license

	Copyright (c) Osmosoft Limited 2005

	Redistribution and use in source and binary forms, with or without modification,
	are permitted provided that the following conditions are met:

	Redistributions of source code must retain the above copyright notice, this list
	of conditions and the following disclaimer.

	Redistributions in binary form must reproduce the above copyright notice, this
	list of conditions and the following disclaimer in the documentation and/or
	other materials provided with the distribution.

	Neither the name of the Osmosoft Limited nor the names of its contributors may
	be used to endorse or promote products derived from this software without
	specific prior written permission.

	THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
	ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
	WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
	DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
	ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
	(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
	LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
	ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
	(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
	SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
	--------------------------------------------------------------------------------
	*/
	if(document.documentElement.classList.contains("init-loading")){'{{BUILD_APP_SOURCE}}'}
	</script>
</body>
</html>
