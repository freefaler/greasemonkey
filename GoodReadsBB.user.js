// ==UserScript==
// @name			GoodReadsBB
// @version			0.4
// @description		GoodReads Search, Request and Upload
// @grant         	GM_deleteValue
// @grant         	GM_getValue
// @grant         	GM_setValue
// @grant						GM_xmlhttpRequest
// @include       	*://www.goodreads.com/book/show/*
// @include					*://bibliotik.me/requests/create/ebooks*
// @include       	*://bibliotik.me/upload/ebooks*
// @include         *://*.axis360.baker-taylor.com/*
// @require       	https://ajax.googleapis.com/ajax/libs/jquery/2.1.4/jquery.min.js
// ==/UserScript==

// this.$ = this.jQuery = jQuery.noConflict(true);

var axisLibraries = []; // ["lib1", "lib2", "lib3"] or [] if none

var simpleToolbar = false;

var authors = [];
var contributors = [];
var editors = [];
var translators = [];

var debug = false;
var infoTime;

var windowHostname = window.location.hostname;
var windowLocation = window.location.toString();

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

function addToolbar() {
	var title = getMainTitle();

	var mainAuthor = $(".authorName:first").text();
	mainAuthor = fixAuthor(mainAuthor);
	console.log('Main Author: ' + mainAuthor);

	var isbn = $('div.infoBoxRowTitle:contains("ISBN")');
	if (isbn.length) {
		isbn = $.trim(isbn.next().clone().children().remove().end().text());
	} else {
		isbn = $('div.infoBoxRowTitle:contains("ASIN")');
		if (isbn.length) {
			isbn = isbn.next().text();
		}
	}

	var isbnString;
	if (/^B\d{2}\w{7}/.test(isbn)) {
		isbnString = 'ASIN';
	} else {
		isbnString = 'ISBN';
	}

	var toolbar = '<span id="bibtoolbar" style="color:#aaaaaa"> ';
	if (simpleToolbar == false) {
		toolbar += 'Bibliotik: '
			+ ' <a class="bib" href="' + 'http://bibliotik.me/requests/create/ebooks" target="_blank">Request</a>'
			+ ' <a class="bib" href="http://bibliotik.me/upload/ebooks" target="_blank">Upload' + '</a>'
			+ ' | Search'
			+ ' <a href="' + searchBibliotik(title, mainAuthor) + '" target="_blank">Title</a>'
			+ ' <a href="' + searchBibliotikAuthor(mainAuthor) + '" target="_blank">Author</a>'
			+ ' <a href="' + searchBibliotikRequest(title, mainAuthor) + '" target="_blank">Request</a>'
			+ '<br/>'
			+ 'Amazon: <a href="' + searchAmazon(title, mainAuthor) + '" target="_blank">Title</a> '
			+ ' <a href="' + searchAmazonAuthor(mainAuthor) + '" target="_blank">Author</a>';
		if (isbn) {
			toolbar += ' <a href="' + searchAmazon(isbn) + '" target="_blank">' + isbnString + '</a>';
		}
		toolbar += ' | <a href="' + searchBN(title, mainAuthor) + '" target="_blank">BN</a>'
			+ ' | <a href="' + searchOverDrive(title, mainAuthor) + '" target="_blank">OverDrive</a>'
			+ ' | <a href="' + searchWorldCat(title, mainAuthor) + '" target="_blank">WorldCat</a>';
	} else {
		toolbar += '<a href="' + searchAmazon(title, mainAuthor) + '" target="_blank">Amazon</a> '
			+ ' <a href="' + searchAmazon(isbn) + '" target="_blank">ISBN</a>'
			+ ' | <a href="' + searchOverDrive(title, mainAuthor) + '" target="_blank">OD</a>'
			+ ' | Bib: '
			+ ' <a class="bib" href="' + 'http://bibliotik.me/requests/create/ebooks" target="_blank">Request</a>'
			+ ' <a href="' + searchBibliotik(title, mainAuthor) + '" target="_blank">Search</a>'
			+ ' <a class="bib" href="http://bibliotik.me/upload/ebooks" target="_blank">Upload' + '</a>';
	}
	toolbar += '<span id="axis" style="display:none">Axis 360: </span></span>';
	$(".textRight.stacked.actionLinkLite").append(toolbar);
}

function checkAxis() {
	var isbns = getISBN13();

	if (isbns.length && axisLibraries.length) {
		isbns.forEach(function (isbn) {
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
		});
	}
}

function checkAxis2() {
	var isbn = getISBN13();
	console.log('ISBN13: ' + isbn);

	if (isbn.length && axisLibraries.length) {
		console.log('Start Axis 360 search for ISBN13: ' + isbn);
		axisLibraries.forEach(function (library) {
			var axisUrl = 'http://' + library + '.axis360.baker-taylor.com/Search?term=' + isbn;
			var url = 'https://www.google.com/search?q=' + isbn + '%20site%3A' + library + '.axis360.baker-taylor.com';
			console.log('Checking ' + library + ' for ' + isbn);
			GM_xmlhttpRequest({
				method: "GET",
				url: url,
				headers: {
					'User-Agent': 'Mozilla/4.0 (compatible; MSIE 9.0;) Greasemonkey',
					'Accept': '*/*'
				},
				onload: function (response) {
					var results = response.responseText.match(/resultStats">\d+/g).toString();
					results = results.replace(/resultStats">(\d+)/, '$1');
					console.log('Found in Axis: ' + results);
					if (results != 0) {
						$('#axis').css('display', 'block');
						axisResults = ' <a target="_blank" href="' + axisUrl + '">' + library.toUpperCase() + '</a>';
						$('#axis').append(axisResults);
					}
				}
			});
		});
	}
}

function fixAuthor(author) {
	return author.replace("Dr. ", "")
		.replace(", MD", "")
		.replace(", Ph.D.", "")
		.replace(" Ph.D.", "")
		.replace(" USA Inc.", "")
		.replace(" DDS", "")
		.replace(" MD", "")
		.replace(" ODD", "")
		.replace(" PhD", "");
}

function fixAuthors(authors) {
	authors = $.map(authors, function (author) {
		return author.replace("Dr. ", "")
			.replace(", MD", "")
			.replace(", Ph.D.", "")
			.replace(" Ph.D.", "")
			.replace(" USA Inc.", "")
			.replace(" DDS", "")
			.replace(" MD", "")
			.replace(" ODD", "")
			.replace(" PhD", "");
	});
	return authors;
}

function fixDescription(description) {
	description = description
		.replace(/<[^\/>][^>]*>\s*<\/[^>]+>/g, "")
		.replace(/<div>\s*<p>/gi, "")
		.replace(/<\/div>/gi, "")
		.replace(/<p>(.*?)<\/p>/g, "\n\n$1")
		.replace(/<span class="h\d+">(.*?)<\/span>/g, "\n$1")
		.replace(/<ul>\s*<li>/gi, "\n\n• ")
		.replace(/<\/li>\s*<li>/gi, "\n• ")
		.replace(/<\/li>\s*<\/ul>/gi, "\n")
		.replace(/<ul>(.*?)<\/ul>/g, "\n$1")
		.replace(/<ul>\s*/g, "")
		.replace(/<li>/gi, "\n• ")
		.replace(/<\/p>\s*<p>/gi, "\n\n")
		.replace(/<\/p>/gi, "")
		.replace(/<p\/>/gi, "")
		.replace(/<\/p><br> <br><p>/gi, "\n\n")
		.replace(/<i>\s*<\/i>/gi, "")
		.replace(/<b><\/b>/gi, "")
		.replace(/<\/b>\s*<b>/gi, "")
		.replace(/<em>\s*<\/em>/gi, "")
		.replace(/<br>/gi, "\n")
		.replace(/<br\/>/gi, "\n")
		.replace(/<p>/gi, "\n")
		.replace(/<div>/gi, "")
		.replace(/<blockquote>/gi, "")
		.replace(/<\/blockquote>/gi, "")
		.replace(/<br\s\/>/gi, "\n")
		.replace(/<i> /gi, " [i]")
		.replace(/<i>/gi, "[i]")
		.replace(/,<\/i>/gi, "[\/i],")
		.replace(/ <\/i>/gi, "[\/i] ")
		.replace(/<\/i>/gi, "[\/i]")
		.replace(/<b> /gi, " [b]")
		.replace(/<b>/gi, "[b]")
		.replace(/ <\/b>/gi, "[/b] ")
		.replace(/<\/b>/gi, "[/b]")
		.replace(/<strong>/gi, "[b]")
		.replace(/<\/strong>/gi, "[/b]")
		.replace(/<em>/gi, "[i]")
		.replace(/<\/em>/gi, "[\/i]")
		.replace(/\n\n\n+/gim, '\n\n')
		.trim();
	// empty tags
	description = decodeEntities(description);
	return description;
}

function getAuthor() {
	// old way
//	var author = $("span[itemprop*=author]").children(".authorName").map(function () {
	var author = $("span[itemprop*=author]").find("span[itemprop*=name]").map(function () {
		return $(this).text();
	}).get().join(", ");
	author = fixAuthor(author);
	console.log(author);
}

function getAuthors() {
	// reset arrays
	authors.length = 0;
	editors.length = 0;
	contributors.length = 0;
	translators.length = 0;

//	var mainAuthor = $("span[itemprop*=author]").find("span[itemprop*=name]:first").text();
//	authors.push(mainAuthor);

	// $("span[itemprop*=author]").find("span[itemprop*=name]").filter(function () {
	// $("span[itemprop*=author]").children("a.authorName").filter(function () {
	$("#bookAuthors").find("a.authorName").filter(function () {
		var currentAuthor = $(this).text();

		if ($(this).next('span.authorName.greyText.smallText.role')) {
			var role = $(this).next('span.authorName.greyText.smallText.role').text();
			console.log('Author each: ' + currentAuthor + ' ' + role);
		} else {
			console.log('Author each: ' + currentAuthor);
		}

		if (role) {
			if (role.indexOf("ditor") >= 0) {
				editors.push(currentAuthor);
				return (false);
			}
			if (role.toLowerCase().indexOf("trans") >= 0) {
				translators.push(currentAuthor);
				return (false);
			}
			contributors.push(currentAuthor);
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

function getISBN13() {

	var isbns = [];
	var isbnsfound = $('html').text().match(/nisbn13: (\d+)/g);
	if (isbnsfound) {
		isbns = isbnsfound.toString().replace(/nisbn13: /g, '').split(',');
	}

	var isbn;

	if ($('.greyText:contains("ISBN13")').length) {
		isbn = $('.greyText:contains("ISBN13")').text().match(/\d{13}/); // find("span[itemprop*=isbn]")
		isbns.push(isbn.toString());
	}
	if ($('div.infoBoxRowTitle:contains("ISBN13")').length) {
		isbn = $('div.infoBoxRowTitle:contains("ISBN13")').next().text();
		isbns.push(isbn.toString());
	}
	console.log('ISBN13s found: ' + isbns.length);
	return isbns;
}

function getMainTitle() {
	var title = $('#bookTitle').text();
	if (title.indexOf("(") >= 0) {
		title = title.substr(0, title.indexOf('('));
	}
	if (title.indexOf(":") >= 0) {
		title = title.substr(0, title.indexOf(':'));
	}
	return $.trim(title);
}

function getPublisher() {
	var publisher = $('div.row:contains("Published")').text();
	if (publisher.indexOf(" by ") >= 0) {
		publisher = publisher.split(' by ').pop();
		if (publisher.indexOf("(") >= 0) {
			// publisher = $.trim(publisher.substr(0, publisher.indexOf(' (')));
			publisher = publisher.split(' (')[0];
		}
		publisher = publisher
			.replace(", Inc.", "")
			.replace(", UK", "")
			.replace(", USA", "");
		publisher = $.trim(publisher);
		return publisher
	} else {
		return "";
	}
}

function getBookInfo(save) {
	var start = performance.now();

	var title = $.trim($('#bookTitle').text());
	title = title.replace(/\s\s+/g, ' '); // trim multiple spaces
	console.log('Title: ' + title);

	getAuthors();

	var description = $('#description').children('span').last().html(); // .readable.stacked
	if (description) {
		description = fixDescription(description);
	} else {
		description = "";
	}
	console.log(description);

	var isbn = $('div.infoBoxRowTitle:contains("ISBN")');
	if (isbn.length) {
		isbn = $.trim(isbn.next().clone().children().remove().end().text());
	} else {
		isbn = "";
	}

	console.log('ISBN: ' + isbn);

	var publisher = getPublisher();
	console.log('Publisher: ' + publisher);

	var year = $('div.row:contains("Published")');
	if (year.length) {
		year = year.text().match(/\d{4}/)[0];
	} else {
		year = "";
	}
	console.log('Year: ' + year);

	var pages = $("span[itemprop*=numberOfPages]").text();
	if (pages) {
		pages = pages.match(/\d+/)[0];
	} else {
		pages = "";
	}
	console.log('Pages: ' + pages);

	var imageURL = $("#coverImage");
	if (imageURL.length) {
		imageURL = imageURL.attr("src").replace("https", "http");
	} else {
		imageURL = "";
	}
	console.log('Image: ' + imageURL);

	if (save) {
		if (authors.length > 0) {
			GM_setValue('grAuthors', authors.join(", "));
		} else {
			GM_setValue('grAuthors', "[none]");
		}

		GM_setValue('grEditors', editors.join(", "));
		GM_setValue('grContributors', contributors.join(", "));
		GM_setValue('grTranslators', translators.join(", "));
		GM_setValue('grTitle', title);
		GM_setValue('grPublisher', publisher);
		GM_setValue('grYear', year);
		GM_setValue('grPages', pages);
		GM_setValue('grISBN', isbn);
		GM_setValue('grImage', imageURL);
		GM_setValue('grDescription', description);

		var tags = $('a.actionLinkLite:contains("Non Fiction")').length;
		if (tags == "1") {
			GM_setValue('grTags', "nonfiction, ");
		} else {
			tags = $('a.actionLinkLite:contains("Fiction")').length;
			if (tags == "1") {
				GM_setValue('grTags', "fiction, ");
			}
		}

	}
	var end = performance.now();
	infoTime = end - start;
}

function printInfo() {
	if (debug) {
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
}

function requestFormat(formatCode, value) {
	$('input[name="FormatsField[]"][value="' + formatCode + '"]')
		.prop("checked", value);
}

function createRequest() {

	if (GM_getValue('grTitle', false)) {
		console.log("GoodReads request.");

		$('#TitleField').val(GM_getValue('grTitle'));
		if (GM_getValue('grAuthors') !== "[none]") {
			$('#AuthorsField').val(GM_getValue('grAuthors'));
		}
		$('#ContributorsField').val(GM_getValue('grContributors'));
		$('#EditorsField').val(GM_getValue('grEditors'));
		$('#TranslatorsField').val(GM_getValue('grTranslators'));
		$('#PublishersField').val(GM_getValue('grPublisher'));
		$('#NotesField').val(GM_getValue('grDescription'));
		$('#TagsField').val(GM_getValue('grTags'));

		// requestFormat(16, false); // MOBI
		// requestFormat(15, true); // EPUB
		// requestFormat(21, false); // AZW3

		$('#RetailField').prop("checked", true); // Retail only

		if (GM_getValue('grTranslators', false) || GM_getValue('grContributors', false)) {
			$('#toggle')[0].click();
		}

		//$("#TagsField").focus();
		$("#FormatsField1").focus();

		GM_deleteValue('grTitle');
		GM_deleteValue('grAuthors');
		GM_deleteValue('grContributors');
		GM_deleteValue('grEditors');
		GM_deleteValue('grTranslators');
		GM_deleteValue('grTags');
		GM_deleteValue('grPublisher');
		GM_deleteValue('grYear');
		GM_deleteValue('grPages');
		GM_deleteValue('grISBN');
		GM_deleteValue('grImage');
		GM_deleteValue('grDescription');
	}
}

function createUpload() {
	if (GM_getValue('grTitle', false)) {
		if (debug) {
			console.log('GoodReads upload.');
			$('fieldset').after('<br/>GoodReads upload.');
		}
		$('#TitleField').val(GM_getValue('grTitle'));
		if (GM_getValue('grAuthors') !== "[none]") {
			$('#AuthorsField').val(GM_getValue('grAuthors'));
		}
		$('#EditorsField').val(GM_getValue('grEditors'));
		$('#ContributorsField').val(GM_getValue('grContributors'));
		$('#TranslatorsField').val(GM_getValue('grTranslators'));
		$('#PublishersField').val(GM_getValue('grPublisher'));
		$('#YearField').val(GM_getValue('grYear'));
		$('#PagesField').val(GM_getValue('grPages'));
		$('#IsbnField').val(GM_getValue('grISBN'));
		$('#ImageField').val(GM_getValue('grImage', ""));
		$('#DescriptionField').val(GM_getValue('grDescription'));
		$('#TagsField').val(GM_getValue('grTags'));

		if (GM_getValue('grTranslators', false) || GM_getValue('grContributors', false)) {
			$('#toggle')[0].click();
		}

		$('#RetailField').prop("checked", true); // Retail only

		$("#FormatField").focus();

		GM_deleteValue('grTitle');
		GM_deleteValue('grAuthors');
		GM_deleteValue('grContributors');
		GM_deleteValue('grEditors');
		GM_deleteValue('grTranslators');
		GM_deleteValue('grPublisher');
		GM_deleteValue('grYear');
		GM_deleteValue('grTags');
		GM_deleteValue('grPages');
		GM_deleteValue('grISBN');
		GM_deleteValue('grImage');
		GM_deleteValue('grDescription');
	}
}

function quoteWords(word) {
	return encodeURIComponent(word.replace(/(\w+([-'])(\w+)?[']?(\w+)?)/, '%22$1%22'));
}

function searchAmazon(title, author) {
	if (author) {
		return "http://www.amazon.com/s?ie=UTF8&index=blended&keywords=" + encodeURIComponent(title) + " " + author;
	} else {
		if (/^B\d{2}\w{7}/.test(title)) {
			return "http://www.amazon.com/dp/" + encodeURIComponent(title);
		} else {
			return "http://www.amazon.com/s?ie=UTF8&index=blended&keywords=" + title;
		}
	}
}

function searchAmazonAuthor(author) {
	return "http://www.amazon.com/gp/search/ref=sr_adv_b/?search-alias=stripbooks&unfiltered=1&sort=relevanceexprank&Adv-Srch-Books-Submit.x=0&Adv-Srch-Books-Submit.y=0&field-author=" + author;
}

function searchBN(title, author) {
	return "http://www.barnesandnoble.com/s/" + encodeURIComponent(title) + " " + author
}

function searchBibliotik(title, author) {
	if (author.length) {
		return 'http://bibliotik.me/torrents/?orderby=added&order=desc&search=' + quoteWords(title)
			+ ' @creators ' + quoteWords(author);
	} else {
		return 'http://bibliotik.me/torrents/?orderby=added&order=desc&search=' + quoteWords(title);
	}
}

function searchBibliotikAuthor(author) {
	return 'http://bibliotik.me/torrents/?orderby=added&order=desc&search=' + '@creators ' + quoteWords(author);
}

function searchBibliotikRequest(title, author) {
	if (author.length) {
		return 'http://bibliotik.me/requests/?orderby=added&order=desc&search=' + quoteWords(title)
			+ ' @creators ' + quoteWords(author);
	} else {
		return 'http://bibliotik.me/requests/?orderby=added&order=desc&search=' + quoteWords(title);
	}
}

function searchGoodReads(title, author) {
	return "https://www.goodreads.com/search?utf8=%E2%9C%93&query=" + encodeURIComponent(title) + ' ' + author;
}

function searchOverDrive(title, author) {
	return "https://www.overdrive.com/search?&autoLibrary=f&autoRegion=t&showAvailable=False&q="
			+ encodeURIComponent(title) + " " + author;
}

function searchWorldCat(title, author) {
	return 'https://www.worldcat.org/search?q=ti%3A' + encodeURIComponent(title) + '+au%3A' + author + '&qt=advanced';
}

if (windowHostname == 'www.goodreads.com') {
	addToolbar();
	$(document.body).on("click", ".bib", {save: true}, getBookInfo);
	checkAxis();

	getAuthors(); // for debug
	getBookInfo(false); // for debug
	//printInfo(); // for debug and more debug
}
if (windowLocation.indexOf("requests") >= 0) {
	createRequest();
}
if (windowLocation.indexOf("upload") >= 0) {
	createUpload();
}
