var request = require('request');
var cheerio = require('cheerio');

module.exports = InventoryHistory;

function InventoryHistory() {
	this._jar = request.jar();
	this._request = request.defaults({"jar": this._jar});
}

InventoryHistory.prototype.setCookies = function(cookies) {
	var self = this;
	cookies.forEach(function(cookie) {
		self.setCookie(cookie);
	});
};

InventoryHistory.prototype.setCookie = function(cookie) {
	this._jar.setCookieSync(request.cookie(cookie), 'http://steamcommunity.com');
};

InventoryHistory.prototype.getHistory = function(options, callback) {
	if(typeof options === 'function') {
		callback = options;
		options = {};
	}
	
	options.page = options.page || 1;
	
	this._request("http://steamcommunity.com/my/inventoryhistory?l=english&p=" + options.page, function(err, response, body) {
		if(err) {
			callback(err);
			return;
		}
		
		var output = {};
		var vanityURLs = [];
		
		var $ = cheerio.load(body);
		var match = $('.inventory_history_pagingrow').html().match(/(\d+) - (\d+) of (\d+) History Items/);
		
		output.first = parseInt(match[1], 10);
		output.last = parseInt(match[2], 10);
		output.totalTrades = parseInt(match[3], 10);
		
		// Load the inventory item data
		var historyInventory = JSON.parse(body.match(/var g_rgHistoryInventory = (.*);/)[1]);
		
		output.trades = [];
		var trades = $('.tradehistoryrow');
		
		var item, trade, profileLink, items, j, domItem, econItem, url, info, style, k, parts;
		for(var i = 0; i < trades.length; i++) {
			item = $(trades[i]);
			trade = {};
			
			trade.date = item.find('.tradehistory_date').html();
			trade.time = item.find('.tradehistory_timestamp').html();
			trade.partnerName = item.find('.tradehistory_event_description a').html();
			trade.partnerSteamID = null;
			trade.partnerVanityURL = null;
			trade.itemsReceived = [];
			trade.itemsGiven = [];
			
			profileLink = item.find('.tradehistory_event_description a').attr('href');
			if(profileLink.indexOf('/profiles/') != -1) {
				trade.partnerSteamID = profileLink.match(/(\d+)$/)[1];
			} else {
				trade.partnerVanityURL = profileLink.match(/\/([^\/]+)$/)[1];
				if(options.resolveVanityURLs && vanityURLs.indexOf(trade.partnerVanityURL) == -1) {
					vanityURLs.push(trade.partnerVanityURL);
				}
			}
			
			items = item.find('.history_item');
			for(j = 0; j < items.length; j++) {
				match = body.match(new RegExp("HistoryPageCreateItemHover\\( '" + $(items[j]).attr('id') + "', (\\d+), '(\\d+)', '(\\d+)', '(\\d+)' \\);"));
				econItem = historyInventory[match[1]][match[2]][match[3]];
				
				if($(items[j]).attr('id').indexOf('received') != -1) {
					trade.itemsReceived.push(econItem);
				} else {
					trade.itemsGiven.push(econItem);
				}
			}
			
			output.trades.push(trade);
		}
		
		if(options.resolveVanityURLs) {
			// TODO: Resolve vanity URLs
		}
		
		callback(null, output);
	});
};