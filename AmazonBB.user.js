// ==UserScript==
// @name			AmazonBB
// @namespace		hello
// @version			0.32
// @description		Search, Request and Upload from Amazon
// @grant         	GM_deleteValue
// @grant         	GM_getValue
// @grant         	GM_setValue
// @grant						GM_xmlhttpRequest
// @include       	*://www.amazon.*/*/dp/*
// @include       	*://www.amazon.*/gp/*
// @include       	*://bibliotik.me/upload/ebooks*
// @include         *://bibliotik.me/requests/create/ebooks*
// @require       	https://ajax.googleapis.com/ajax/libs/jquery/2.1.4/jquery.min.js
// comment
// ==/UserScript==

var axisLibraries = []; // ["lib1", "lib2", "lib3"] or [] if none

var authors = [];
var contributors = [];
var editors = [];
var translators = [];

var debug = true;
var infoTime;

var windowHostname = window.location.hostname;
var windowLocation = window.location.toString();

// Scrape Amazon
// https://gist.github.com/destroytoday/6706265

(function ($) {
	// text with line breaks
	// http://stackoverflow.com/questions/22678446/how-to-keep-line-breaks-when-using-text-method-for-jquery
	$.fn.innerText = function (msg) {
		if (msg) {
			if (document.body.innerText) {
				for (var i in this) {
					this[i].innerText = msg;
				}
			} else {
				for (var i in this) {
					this[i].innerHTML.replace(/&amp;lt;br&amp;gt;/gi, "n").replace(/(&amp;lt;([^&amp;gt;]+)&amp;gt;)/gi, "");
				}
			}
			return this;
		} else {
			if (document.body.innerText) {
				return this[0].innerText;
			} else {
				return this[0].innerHTML.replace(/&amp;lt;br&amp;gt;/gi, "n").replace(/(&amp;lt;([^&amp;gt;]+)&amp;gt;)/gi, "");
			}
		}
	};
})(jQuery);

jQuery.expr[':'].regex = function (elem, index, match) {
	var matchParams = match[3].split(','),
		validLabels = /^(data|css):/,
		attr = {
			method: matchParams[0].match(validLabels) ?
				matchParams[0].split(':')[0] : 'attr',
			property: matchParams.shift().replace(validLabels, '')
		},
		regexFlags = 'ig',
		regex = new RegExp(matchParams.join('').replace(/^s+|s+$/g, ''), regexFlags);
	return regex.test(jQuery(elem)[attr.method](attr.property));
}

function ContainsAny(str, items) {
	for (var i in items) {
		var item = items[i];
		if (str.indexOf(item) > -1) {
			return true;
		}
	}
	return false;
}

var decodeEntities = (function () {
	// this prevents any overhead from creating the object each time
	var element = document.createElement('div');

	// regular expression matching HTML entities
	var entity = /&(?:#x[a-f0-9]+|#[0-9]+|[a-z0-9]+);?/ig;

	return function decodeHTMLEntities(str) {
		// find and replace all the html entities
		str = str.replace(entity, function (m) {
			element.innerHTML = m;
			return element.textContent;
		});

		// reset the value
		element.textContent = '';

		return str;
	}
})();

function addToolbar(title, author) {
	if ($('li:contains("ISBN-10: ")').length) {
		$('#tell-a-friend')
			.append('<span id="bibtoolbar"><br/>Bibliotik: '
			+ ' <a target="_blank" href="' + searchBibliotik(title, author) + '">Title</a>'
			+ ' <a target="_blank" href="' + searchBibliotikAuthor(author) + '">Author</a>'
			+ ' | <a target="_blank" class="bib" href="http://bibliotik.me/requests/create/ebooks" target="_blank">Request'
			+ '</a> <a target="_blank" class="bib" href="http://bibliotik.me/upload/ebooks" target="_blank">Upload</a>'
			+ '<br/><span class="search1">Search:</span>'
			+ ' <a target="_blank" href="' + searchBN(title, author) + '">BN</a>'
			+ ' <a target="_blank" href="' + searchGoodReads(title, author) + '">GoodReads</a>'
			+ ' <a target="_blank" href="' + searchOverDrive(title, author) + '" target="_blank">OverDrive</a></span>'
			+ '<span id="axis" style="display:none"><br/>Axis 360: </span>');
	} else {
		if ($('li:contains("ASIN:")').length) {
			console.log("Kindle");
			$('#rightCol')
				.prepend('<div id="tellAFriendBylineBox_feature_div" class="feature a-section a-text-center a-spacing-small">Bibliotik:'
				+ ' <a target="_blank" href="' + searchBibliotik(title, author) + '">Title</a>'
				+ ' <a target="_blank" href="' + searchBibliotikAuthor(author) + '">Author</a>'
				+ ' | <a target="_blank" class="bib" href="http://bibliotik.me/requests/create/ebooks">Request</a>'
				+ '<br/><span class="search1">Search:</span>'
				+ ' <a target="_blank" href="' + searchBN(title, author) + '">BN</a>'
				+ ' <a target="_blank" href="' + searchGoodReads(title, author) + '">GoodReads</a>'
				+ ' <a target="_blank" href="' + searchOverDrive(title, author) + '">OverDrive</a></div>'
				+ '<span id="axis" style="display:none"><br/>Axis 360: </span>');
		}
	}
}

function checkAxis() {
	var isbn = getISBN13();
	if (isbn.length && axisLibraries.length) {
		console.log('Start Axis 360 search for ISBN13: ' + isbn);
		axisLibraries.forEach(function (library) {
			var axisUrl = 'http://' + library + '.axis360.baker-taylor.com/Title?itemId=';
			var url = 'http://' + library + '.axis360.baker-taylor.com/Search/GetContent?term=' + isbn;
			GM_xmlhttpRequest({
				method: "GET",
				url: url,
				onload: function (response) {
					var results = $.parseJSON(response.responseText);
					if (results.TotalHits != 0) {
						console.log('Found in Axis: ' + library);
						var axisLink = ' <a target="_blank" href="' + axisUrl + results.Books[0].BookID + '">'
							+ library.toUpperCase() + '</a>';
						$('#axis').append(axisLink);
						$('#axis').css('display', 'block');
					}
				}
			});
		});
	}
}

function checkAxis2(isbn) {
	var url = "http://anyorigin.com/dev/get?url=http%3A//lapl.axis360.baker-taylor.com/Search%3Fterm%3D" + isbn + "&callback=?";
	$.getJSON(url, function (data) {
		console.log('Start Bibliotik for ISBN: ' + isbn);
		var found = $('.pagination:first', $(data)).text();
		console.log(found + ' found in Axis');
		$('#bibtoolbar').append('<br/>Axis: ' + found);
		// $('#output').html(data.contents);
	});
}

function fixAuthor(author) {
	author = author
		.replace(", MD", "")
		.replace(", Ph.D.", "")
		.replace(" USA Inc.", "");
	return author;
}

function fixAuthors(authors) {
	authors = $.map(authors, function (author) {
		return author.replace("Dr. ", "")
			.replace(", MD", "")
			.replace(", Ph.D.", "")
			.replace(" Ph.D.", "")
			.replace(" USA Inc.", "");
	});
	return authors;
}

function fixDescription(description) {
	console.log(description);
	description = description
		.replace(/<[^\/>][^>]*><\/[^>]+>/, "")
		.replace(/<p>\s*/g, "<p>")
		.replace(/<p>(.*?)<\/p>/g, "\n\n$1")
		.replace(/<div>(.*?)<\/div>/g, "$1")
		.replace(/<b>(.*?)<\/b>/gi, "[b]$1[/b]")
		.replace(/<i>(.*?)<\/i>/gi, "[i]$1[/i]")
		.replace(/<cite>(.*?)<\/cite>/g, "[i]$1[/i]")
		.replace(/<em>(.*?)<\/em>/gi, "[i]$1[/i]")
		.replace(/<h2>(.*?)<\/h2>/g, "\n\n$1")
		.replace(/<h3>(.*?)<\/h3>/g, "\n\n$1")
		.replace(/<em>\s*<\/em>/gi, " ")
		.replace(/<b>\s*<\/b>/gi, " ")
		.replace(/<i>\s*<\/i>/gi, " ")
		.replace(/<\/i><i>/gi, "")
		.replace(/<\/b><b>/gi, "")
		.replace(/<\/i>\s*<i>/gi, " ")
		.replace(/<\/b>\s*<b>/gi, " ")
		.replace(/<\/p>\s*<p>/gi, "\n\n")
		.replace(/<div>\s*<p>/gi, "")
		.replace(/<\/div>/gi, "")
		.replace(/<span class="h\d+">(.*?)<\/span>/g, "\n$1")
		.replace(/<ul>\s*<li>/gi, "\n\n• ")
		.replace(/<\/li>\s*<li>/gi, "\n• ")
		.replace(/<\/li>\s*<\/ul>/gi, "\n")
		.replace(/<ul>(.*?)<\/ul>/g, "\n$1")
		.replace(/<ul>\s*/g, "")
		.replace(/<ol>/gi, "\n")
		.replace(/<li>/gi, "\n• ")
		.replace(/<p\/>/gi, "")
		.replace(/<\/p><br> <br><p>/gi, "\n\n")
		.replace(/<br>/gi, "\n")
		.replace(/<br\/>/gi, "\n")
		.replace(/<p>/gi, "\n")
		.replace(/<div>/gi, "")
		.replace(/<blockquote>/gi, "")
		.replace(/<\/blockquote>/gi, "")
		.replace(/<br\s\/>/gi, "\n")
		.replace(/<b> /gi, " [b]")
		.replace(/<b>/gi, "[b]")
		.replace(/ <\/b>/gi, "[/b] ")
		.replace(/<\/b>/gi, "[/b]")
		.replace(/<strong>/gi, "[b]")
		.replace(/<\/strong>/gi, "[/b]")
		.replace(/<em>/gi, "[i]")
		.replace(/<\/em>/gi, "[\/i]")
		.replace(/\n\s*?\n\s*?\n+/gim, '\n\n')
		.trim();
	// console.log(description); // to show remaining HTML
	description = description.replace(/<(?:.|\s)*?>/g, "");
	description = decodeEntities(description);
	return description;
}

function fixPublisher(publisher) {
	publisher = publisher
		.replace(", Inc.", "")
		.replace(", LLC", "")
		.replace(", UK", "")
		.replace(", USA", "");
	publisher = $.trim(publisher);
	return publisher;
}

function getAuthor() {
	var author = $("a.a-link-normal.contributorNameID").map(function () {
		return $(this).text();
	}).get().join(", ");
	var author2 = $('span.author.notFaded > a.a-link-normal');
	if (author2.length >= 1) {
		if (!author) {
			author = author2.map(function () {
				return $(this).text();
			}).get().join(", ");
		} else {
			author += ", " + author2.map(function () {
					return $(this).text();
				}).get().join(", ");
		}
	}
	author = author
		.replace(/ M\.A\./g, "")
		.replace(/ M\.D\./g, "")
		.replace(/ Ph\.D\./g, "")
		.replace(/Dr /g, "");
	author = $.trim(author);
	console.log('Author: ' + author);
	return author;
}

function getAuthors() {

	// reset arrays
	authors.length = 0;
	editors.length = 0;
	contributors.length = 0;
	translators.length = 0;

	var authorStrings = ["Author", "Auteur"];
	var editorStrings = ["ditor", "Editeur", "Sous la direction"];
	var contributorStrings = ["Introduction", "Preface"];
	var translatorStrings = ["Translator", "Traduction"];

	$('span.author > a').add('span.a-declarative > a.a-link-normal.contributorNameID').filter(function () {
		var currentAuthor = $(this).text().trim();

		var role;
		if ($(this).next('span').length === 0) {
			role = $(this).parent().next().text().trim();
			console.log('Author each 1: ' + currentAuthor + ' ' + role);
		} else {
			role = $(this).next().text().trim();
			console.log('Author each 2: ' + currentAuthor + ' ' + role);
		}

		if (role) {
			if (ContainsAny(role, authorStrings)) {
				authors.push(currentAuthor);
			}
			if (ContainsAny(role, editorStrings)) {
				editors.push(currentAuthor);
			}
			if (ContainsAny(role, translatorStrings)) {
				translators.push(currentAuthor);
			}
			if (ContainsAny(role, contributorStrings)) {
				contributors.push(currentAuthor);
			}
			return (false);
		} else {
			authors.push(currentAuthor);
		}
	});
	authors = fixAuthors(authors);
	editors = fixAuthors(editors);
	contributors = fixAuthors(contributors);
	translators = fixAuthors(translators);
	console.log("Authors: " + authors.join(", "));
	console.log("Editors: " + editors.join(", "));
	console.log("Contributors: " + contributors.join(", "));
	console.log("Translators: " + translators.join(", "));
}

function getBookInfo(save) {
	var start = performance.now();

	var title = $("#productTitle").text().replace(/, (\d+)th Edition/, " ($1th Edition)");

	// var edition = $('.a-color-secondary:contains("Edition: ")').next().text();
	// edition = edition.replace("Edition: ", "");

	//var edition = $('li:contains("Publisher: ")').text()
	//	.replace("Publisher: ", "")
	//	.replace("third", "3rd")
	//	.replace("edition", "Edition")
	//	.replace(" Edition", "th Edition")
	//	.replace("2th", "2nd")
	//	.replace("3th", "3rd")
	//	.replace("1th Edition", "");
	//edition = edition.match("\\d+.*? Edition");
	//if (edition) {
	//	edition = " (" + edition + ")";
	//	title += edition;
	//}

	console.log('Title: ' + title);

	getAuthors();

	var description = $('#bookDesc_override_CSS').next().text();
	description = fixDescription(description);
	console.log(description);

	var isbn = $('li:contains("ISBN-10: ")').text();
	isbn = isbn.replace("ISBN-10: ", ""); // pop : instead?
	console.log('ISBN: ' + isbn);

	var publisher = $('li:contains("Publisher: "), li:contains("Editeur :")').text();
	publisher = publisher.replace("Publisher: ", "").replace("Editeur : ", "");
	publisher = publisher.substr(0, publisher.indexOf(' ('));
	if (publisher.indexOf(";") >= 0) {
		publisher = publisher.substr(0, publisher.indexOf(';'));
	}
	if (publisher.indexOf(", Inc.") >= 0) {
		publisher = publisher.substr(0, publisher.indexOf(', Inc.'));
	}
	publisher = fixPublisher(publisher);
	console.log('Publisher: ' + publisher);

	var year = $('li:contains("Publisher: "), li:contains("Editeur")').text().match(/\d{4}/);
	console.log('Year: ' + year);

	var pages = $('li:contains(" pages")').text().match(/(\d+) pages/)[1];
	console.log('Pages: ' + pages);

	var imageURL = $("#imgBlkFront");
	if (imageURL.length) {
		imageURL = imageURL.attr('data-a-dynamic-image')
				.match(new RegExp('{"' + "(.*)" + '.jpg'))[1].split(/_(.+)?/)[0] + "jpg";
	} else {
		imageURL = $("#mainImageContainer > img").attr('data-a-dynamic-image')
				.match(new RegExp('{"' + "(.*)" + '.jpg'))[1].split(/_(.+)?/)[0] + "jpg";
	}
	console.log('Image: ' + imageURL);

	if (save) {
		console.log('Saving Amazon info.');
		if (authors.length > 0) {
			GM_setValue('amazonAuthors', authors.join(", "));
		} else {
			GM_setValue('amazonAuthors', "[none]");
		}

		GM_setValue('amazonContributors', contributors.join(", "));
		GM_setValue('amazonEditors', editors.join(", "));
		GM_setValue('amazonTranslators', translators.join(", "));
		// GM_setValue('amazonAuthor', author);
		GM_setValue('amazonTitle', title);
		GM_setValue('amazonPublisher', publisher);
		GM_setValue('amazonYear', year);
		GM_setValue('amazonPages', pages);
		GM_setValue('amazonISBN', isbn);
		GM_setValue('amazonImage', String(imageURL));
		GM_setValue('amazonDescription', description);

		var type = $('span.zg_hrsr_ladder > a').text();
		if (ContainsAny(type, ["Literature", "Fantasy", "Mystery", "Poetry"])) {
			GM_setValue('amazonTags', "fiction, ");
		} else {
			GM_setValue('amazonTags', "nonfiction, ");
		}
		if (type.indexOf("Criticism") >= 0) {
			GM_setValue('amazonTags', "nonfiction, ");
		}

		if (windowLocation.indexOf("amazon.fr") >= 0) {
			GM_setValue('amazonLanguage', 3);
		}
	}

	var end = performance.now();
	infoTime = end - start;
}

function getISBN13() {
	var isbn = $('li:contains("ISBN-13: ")');
	if (isbn.length) {
		isbn = isbn.text().replace("ISBN-13: ", ""); // pop : instead?
		isbn = isbn.replace("-", "");
		return isbn;
	} else {
		return "";
	}
}

function getMainAuthor() {
	var author = $(".a-link-normal.contributorNameID:first").text().replace(/ [A-Z]\. /, " ");
	if (!author) {
		author = $('.author.notFaded > .a-link-normal:first').text().replace(/ [A-Z]\. /, " ")
			.replace(/ Ph\.D\./g, "");
	}
	if (!author) {
		author = $('.contributorNameTrigger:first').text().replace(/ [A-Z]\. /, " ");
	}
	return author;
}

function getMainTitle() {
	var title = $("#productTitle");
	if (title.length) {
		title = title.text().replace(/, \d+th Edition/, "").replace(/ (\d+th Edition)/, "");
	} else {
		title = $("#btAsinTitle").text().replace(/, \d+th Edition/, "").replace(/ (\d+th Edition)/, "");
	}
	if (title.indexOf("(") >= 0) {
		title = title.substr(0, title.indexOf(' ('));
	}
	if (title.indexOf("[") >= 0) {
		title = title.substr(0, title.indexOf(' ['));
	}
	if (title.indexOf(":") >= 0) {
		title = title.substr(0, title.indexOf(':'));
	}
	title = title.replace(/:/, " ");
	return title;
}

function printInfo() {
	var results = "";

	if (authors.length > 0) {
		results += '<br/>Authors: ' + authors.join(', ')
	}
	if (editors.length > 0) {
		results += '<br/>Editors: ' + editors.join(', ')
	}
	if (contributors.length > 0) {
		results += '<br/>Contributors: ' + contributors.join(', ')
	}
	if (translators.length > 0) {
		results += '<br/>Translators: ' + translators.join(', ')
	}
	results += '<br/>Time: ' + String(infoTime.toPrecision(5));
	$('#bibtoolbar').append(results);
}

function requestFormat(formatCode, value) {
	$('input[name="FormatsField[]"][value="' + formatCode + '"]')
		.prop("checked", value);
}

function createRequest() {
	if (GM_getValue('amazonAuthors', false)) {
		console.log('Amazon request.');
		$('#TitleField').val(GM_getValue('amazonTitle'));
		if (GM_getValue('amazonAuthors') !== "[none]") {
			$('#AuthorsField').val(GM_getValue('amazonAuthors'));
		}
		$('#PublishersField').val(GM_getValue('amazonPublisher'));
		$('#NotesField').val(GM_getValue('amazonDescription'));

		$('#RetailField').prop("checked", true); // Retail only

		$("#FormatsField1").focus();

		GM_deleteValue('amazonAuthors');
		GM_deleteValue('amazonTitle');
		GM_deleteValue('amazonPublisher');
		GM_deleteValue('amazonDescription');
	}
}

function createUpload() {
	if (GM_getValue('amazonAuthors', false)) {
		if (debug) {
			console.log('Amazon upload.');
			// $('fieldset').after('<br/>Amazon upload.');
		}
		$('#TitleField').val(GM_getValue('amazonTitle'));

		if (GM_getValue('amazonAuthors') !== "[none]") {
			$('#AuthorsField').val(GM_getValue('amazonAuthors'));
		}
		$('#EditorsField').val(GM_getValue('amazonEditors'));
		$('#ContributorsField').val(GM_getValue('amazonContributors'));
		$('#TranslatorsField').val(GM_getValue('amazonTranslators'));
		if ($('#TranslatorsField').val() != "" || $('#ContributorsField').val() != "") {
			$('#toggle')[0].click();
		}

		$('#PublishersField').val(GM_getValue('amazonPublisher'));
		$('#IsbnField').val(GM_getValue('amazonISBN'));
		$('#PagesField').val(GM_getValue('amazonPages'));
		$('#YearField').val(GM_getValue('amazonYear'));
		$('#TagsField').val(GM_getValue('amazonTags'));
		$('#ImageField').val(GM_getValue('amazonImage'));
		$('#DescriptionField').val(GM_getValue('amazonDescription'));

		$('#RetailField').prop("checked", true); // Retail only

		$("#FormatField").focus();

		if (GM_getValue('amazonLanguage', false)) {
			$('#LanguageField').val(GM_getValue('amazonLanguage'));
			$('#TagsField').val("");
		}

		GM_deleteValue('amazonTitle');
		GM_deleteValue('amazonAuthors');
		GM_deleteValue('amazonEditors');
		GM_deleteValue('amazonContributors');
		GM_deleteValue('amazonTranslators');
		GM_deleteValue('amazonLanguage');
		GM_deleteValue('amazonPublisher');
		GM_deleteValue('amazonISBN');
		GM_deleteValue('amazonPages');
		GM_deleteValue('amazonYear');
		GM_deleteValue('amazonLanguage');
		GM_deleteValue('amazonTags');
		GM_deleteValue('amazonImage');
		GM_deleteValue('amazonDescription');
	}
}

function quoteWords(word) {
	return encodeURIComponent(word.replace(/(\w+([-'])(\w+)?[-']?(\w+)?)/, '"$1"'));
}

function searchAmazon(title, author) {
	return "http://www.amazon.com/s?ie=UTF8&index=blended&keywords=" + title + " " + author
}

function searchBN(title, author) {
	return "http://www.barnesandnoble.com/s/" + encodeURIComponent(title) + " " + author
}

function searchBibliotik(title, author) {
	if (author.length) {
		author = author.replace(/ [A-Z]\. /, " ");
		return 'http://bibliotik.me/torrents/?orderby=added&order=desc&search=' + quoteWords(title)
			+ ' @creators ' + quoteWords(author);
	} else {
		return 'http://bibliotik.me/torrents/?orderby=added&order=desc&search=' + quoteWords(title);
	}
}

function searchBibliotikAuthor(author) {
	author = author.replace(/ [A-Z]\. /, " ");
	return 'http://bibliotik.me/torrents/?orderby=added&order=desc&search=' + '@creators ' + quoteWords(author);
}

function searchBibliotikRequest(title, author) {
	if (author.length) {
		author = author.replace(/ [A-Z]\. /, " ");
		return 'http://bibliotik.me/requests/?orderby=added&order=desc&search=' + quoteWords(title)
			+ ' @creators ' + quoteWords(author);
	} else {
		return 'http://bibliotik.me/requests/?orderby=added&order=desc&search=' + quoteWords(title);
	}
}

function searchGoodReads(title, author) {
	if (author.length) {
		return "https://www.goodreads.com/search?utf8=%E2%9C%93&query=" + encodeURIComponent(title) + ' ' + author;
	} else {
		return "https://www.goodreads.com/search?utf8=%E2%9C%93&query=" + encodeURIComponent(title);
	}
}

function searchOverDrive(title, author) {
	return "https://www.overdrive.com/search?&autoLibrary=f&autoRegion=t&showAvailable=False&q="
		+ encodeURIComponent(title) + " " + author;
}

if (windowHostname !== 'bibliotik.me') {
	//for search
	var title = getMainTitle();
	console.log('Main Title: ' + title);
	var author = getMainAuthor();
	console.log('Main Author: ' + author);

	if ($('li:contains("ISBN-10:"), li:contains("ASIN:")').text()) {
		addToolbar(title, author);
		if (debug) {
			getBookInfo(false);
			//printInfo();
		}
	}

	$(document.body).on("click", ".bib", {save: true}, getBookInfo);
	checkAxis();
} else {
	if (windowLocation.indexOf("requests") >= 0) {
		createRequest();
	} else {
		createUpload();
	}
}

if (windowHostname == 'www.amazon.fr') {
	$('#tell-a-friend').css('font-size', '100%');
	var title = getMainTitle();
	var author = getMainAuthor();
	$('.search1').append(' <a target="_blank" href="http://banq.pretnumerique.ca/resources?utf8=%E2%9C%93&q='
		+ title + ' ' + author + '">BAnQ</a>');
}
