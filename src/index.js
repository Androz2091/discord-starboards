/* eslint-disable no-unused-vars */
const { EventEmitter } = require('events');
const { promisify } = require('util');
const Discord = require('discord.js');

const { writeFile, readFile, exists } = require('fs');
const writeFileAsync = promisify(writeFile);
const existsAsync = promisify(exists);
const readFileAsync = promisify(readFile);

const handleRaw = require('./handlers/raw');

const { StarBoardCreateDefaultsOptions } = require('./constants');


/**
 * Starboards Manager
 */
class StarboardsManager extends EventEmitter {

	/**
     * @param {Discord.Client} client The discord client
     * @param {*} options The manager options
     */
	constructor(client, options = {}) {
		super();
		if (!client) throw new Error('Client is a required parameter.');

		/**
         * Starboards managed by this manager
         * @type {object[]}
         */
		this.starboards = [];

		/**
         * The discord client
         * @type {Discord.Client}
         */
		this.client = client;

		/**
         * Starboard defaults options
         * @type {StarBoardCreateDefaultsOptions}
         */
		this.defaultsOptions = StarBoardCreateDefaultsOptions;

		/**
         * The manager options
         * @type {object}
         */
		this.options = {
			storage: typeof options.storage === 'boolean' || typeof options.storage === 'string' ? options.storage : './starboards.json',
		};

		this._init();

		this.client.on('channelDelete', channel => {
			const channelData = this.starboards.find(data => data.channelID === channel.id);
			if (channelData) return this.delete(channelData.channelID);
		});

		this.client.on('raw', packet => handleRaw(this, packet));

	}

	/**
     * Init the manager
     * @ignore
     * @private
     */
	async _init() {
		this.starboards = await this.getAllStarboards();
	}

	/**
     * Get the final options by mixing the options provided and the default options
     * @param {object} options
     * @private
     */
	_mergeOptions(options) {
		if(!options) return this.defaultsOptions;

		return {
			emoji: typeof options.emoji === 'string' ? options.emoji : this.defaultsOptions.emoji,
			starBotMsg: typeof options.starBotMsg === 'boolean' ? options.starBotMsg : this.defaultsOptions.starBotMsg,
			selfStar: typeof options.selfStar === 'boolean' ? options.selfStar : this.defaultsOptions.selfStar,
			threshold: typeof options.threshold === 'number' ? options.threshold : this.defaultsOptions.threshold,
		};
	}

	/**
     * Create a Starboard and save it in the database
     * @param {Discord.Channel} channel
     * @param {object} options
     * @example
     * manager.create(message.channel.id, {
     *      starBotMsg: false,
     *      threshold: 2,
     * })
     */
	create(channel, options) {

		const channelData = {
			channelID: channel.id,
			guildID: channel.guild.id,
			options: this._mergeOptions(options),
		};

		if(this.starboards.find(data => data.channelID === channelData.channelID &&	data.options.emoji === channelData.options.emoji)) throw new Error('There is already a starboard in this channel with the same emoji');

		this.starboards.push(channelData);
		this.saveStarboard(channelData);

		this.emit('starboardCreate', channelData);

		return true;
	}

	/**
     * Delete a starboard by its guildID
     * @param {Discord.Snowflake} guildID
     * @example
     * manager.delete(message.channel.id)
     */
	delete(channelID) {
		const data = this.starboards.find(channelData => channelData.channelID === channelID);
		if(!data) throw new Error(`The channel "${channelID}" is not a starboard`);

		this.starboards = this.starboards.filter(channelData => channelData.channelID !== channelID);

		this.deleteStarboard(channelID);

		this.emit('starboardDelete', data);

		return true;
	}

	/**
     * Get a list of all starboards in the database.
     * @returns {Promise<object[]>}
     */
	async getAllStarboards() {
		// Whether the storage file exists, or not
		const storageExists = await existsAsync(this.options.storage);
		// If it doesn't exists
		if (!storageExists) {
			// Create the file with an empty array
			await writeFileAsync(this.options.storage, '[]', 'utf-8');
			return [];
		}
		else {
			// If the file exists, read it
			const storageContent = await readFileAsync(this.options.storage);
			try {
				const starboards = await JSON.parse(storageContent.toString());
				if (Array.isArray(starboards)) {
					return starboards;
				}
				else {
					console.log(storageContent, starboards);
					throw new SyntaxError('The storage file is not properly formatted (giveaways is not an array).');
				}
			}
			catch (e) {
				if (e.message === 'Unexpected end of JSON input') {
					throw new SyntaxError('The storage file is not properly formatted (Unexpected end of JSON input).');
				}
				else {
					throw e;
				}
			}
		}
	}

	/**
     * Delete a starboard of the database
     * @param {Discord.Snowflake} channelID
     */
	async deleteStarboard(channelID) {
		await writeFileAsync(
			this.options.storage,
			JSON.stringify(this.starboards),
			'utf-8',
		);
		return true;
	}

	/**
     * Save a starboard in the database
     * @param {object} data
     */
	async saveStarboard(data) {
		await writeFileAsync(
			this.options.storage,
			JSON.stringify(this.starboards),
			'utf-8',
		);
		return true;
	}

}

/**
 * Emitted when a starboard is created
 * @event StarboardsManager#starboardCreate
 * @param {object} data The channel data
 *
 * @example
 * // This can be used to add features such as a log message
 * manager.on('starboardCreate', (data) => {
 *     console.log(`New starboard ! ChannelID: ${data.channelID}`);
 * });
 */

/**
 * Emitted when a starboard is deleted
 * @event StarboardsManager#starboardDelete
 * @param {object} data The channel data
 *
 * @example
 * // This can be used to add features such as a log message
 * manager.on('starboardDelete', (data) => {
 *     console.log(`Starboard deleted ! ChannelID: ${data.channelID}`);
 * });
 */

/**
 * Emitted when a new reaction for a starboard is received, whether the message is cached or not.
 * @event StarboardsManager#starboardReactionAdd
 * @param {string} emoji The emoji
 * @param {Discord.Message} message The message
 * @param {Discord.User} user The user who reacted
 * @example
 * // This can be used to add features such as a an additional filter so that only certain roles have access to the starboard
 * manager.on('starboardReactionAdd', (emoji, message, user) => {
 *      console.log(`${user.username} reacted to a message with ${emoji}.`)
 * });
 */

/**
 * Emitted when a reaction for a starboard is removed, whether the message is cached or not.
 * @event StarboardsManager#starboardReactionRemove
 * @param {string} emoji The emoji
 * @param {Discord.Message} message The message
 * @param {Discord.User} user The user who reacted
 * @example
 * manager.on('starboardReactionRemove', (emoji, message, user) => {
 *      console.log(`${user.username} remove his reaction to a message.`)
 * });
 */

/**
 * Emitted when all reactions to a starboard message are removed, whether the message is cached or not.
 * @event StarboardsManager#starboardReactionRemoveAll
 * @param {Discord.Message} message The message
 * @example
 * manager.on('starboardReactionAdd', (message) => {
 *      console.log(`Message ${message.id} purged.`)
 * });
 */

module.exports = StarboardsManager;