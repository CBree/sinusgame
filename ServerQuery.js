/* eslint-disable lines-around-comment */
/* eslint-disable guard-for-in */
/* eslint-disable camelcase */
registerPlugin({
    name: 'Source Server Query',
    version: '2.3.1',
    description: 'Shows information about most source servers on a channel.',
    author: 'Smorrebrod || Cedrik <cedrik.paetz@gmail.com> / Multivit4min',
    requiredModules: ['net', 'http'],
    vars: [{
        name: 'interval',
        title: 'Update Interval in minutes',
        type: 'number',
        placeholder: 5
    }, {
        name: 'servers',
        title: 'Monitored Servers',
        type: 'array',
        vars: [{
            name: 'server',
            title: 'Server IP',
            indent: 2,
            type: 'string',
            placeholder: 'DNS or IP'
        }, {
            name: 'port',
            title: 'Server Query Port',
            indent: 2,
            type: 'string',
            placeholder: '0-65535'
        }, {
            name: 'serverType',
            title: 'Type of the server.',
            indent: 2,
            type: 'select',
            options: [
                'Source',
                'Gamespy v4',
                'Gamespy v3',
                'Gamespy',
                'Battlefield 2',
                'Battlefield 3',
                'Terraria',
                'FiveM',
				'Eco',
				'ASE'
            ]
        }, {
            name: 'channel',
            title: 'Used Channel',
            indent: 2,
            type: 'channel'
        }, {
            name: 'channelName',
            title: 'Channel name. Possible Placeholders are: %s = status, %g = game,  %m = map, %v = version, %n = name, %p = players online, %pmax = max players, %d = description',
            indent: 2,
            type: 'string'
        }, {
            name: 'channelDescription',
            title: 'Channel description. Possible Placeholders are: %s = status, %g = game,  %m = map, %v = version, %n = name, %p = players online, %pmax = max players, %d = description',
            indent: 2,
            type: 'multiline'
        }]
    }]
}, (_, config) => {

    const engine = require('engine')
    const net = require('net')
    const store = require('store')
    const backend = require('backend')
    const http = require('http')

    const GSKeys = {
        hostname: 'name',
        game_id: 'game',
        gamename: 'game',
        numplayers: 'players',
        playercount: 'players',
		OnlinePlayers: 'players',
        maxplayers: 'playersmax',
        sv_maxclients: 'playersmax',
		TotalPlayers: 'playersmax',
		clients: 'players',
        uptime: 'description',
        plugins: 'description',
        gamemode: 'description',
        gametype: 'description',
		Description: 'description',
		DetailedDescription: 'description',
		Category: 'description',
		WorldObjective: 'description',
        MinNetVersion: 'version',
        gamever: 'version',
        serverversion: 'version',
		Version: 'version',
        mapname: 'map',
        world: 'map',
		WorldSize: 'map'
    }
    let interval = config.interval * 60000
    if (interval < 60000) interval = 60000

    function update() {
        if (backend.getCurrentChannel()) {
            for (const i in config.servers) {
                getServerInformation(config, i)
            }
        }
    }

    update()
    setInterval(update, interval)

    function getServerInformation(config, i) {
        collectServerData(config.servers[i])
    }

    function collectServerData(currentServer) {
        const serverInformation = {}
        serverInformation.status = 0
        if (!currentServer.query || currentServer.protocol == 'http') {
            if (currentServer.serverType) {
                if (currentServer.serverType === '0') {
                    currentServer.query = 'source'
                    currentServer.protocol = 'udp'
                }
                if (currentServer.serverType === '1') {
                    currentServer.query = 'gamespy4'
                    currentServer.protocol = 'udp'
                }
                if (currentServer.serverType === '2') {
                    currentServer.query = 'gamespy3'
                    currentServer.protocol = 'udp'
                }
                if (currentServer.serverType === '3') {
                    currentServer.query = 'gamespy'
                    currentServer.protocol = 'udp'
                }
                if (currentServer.serverType === '4') {
                    currentServer.query = 'battlefield2'
                    currentServer.protocol = 'udp'
                }
                if (currentServer.serverType === '5') {
                    currentServer.query = 'battlefield3'
                    currentServer.protocol = 'tcp'
                }
                if (currentServer.serverType === '6') {
                    currentServer.query = 'terraria'
                    currentServer.protocol = 'http'
                    currentServer.currentInfo = serverInformation
                    requestHTTPData(currentServer)
                    return
                }
                if (currentServer.serverType === '7') {
                    currentServer.query = 'FiveM'
                    currentServer.protocol = 'udp'
                }
				if (currentServer.serverType === '8') {
                    currentServer.query = 'eco'
                    currentServer.protocol = 'http'
                    currentServer.currentInfo = serverInformation
                    requestHTTPData(currentServer)
                    return
                }
				if (currentServer.serverType === '9') {
                    currentServer.query = 'ase'
                    currentServer.protocol = 'udp'
                }
            } else {
                currentServer.query = 'source'
            }
        }
        serverInformation.ip = currentServer.server
        serverInformation.port = parseInt(currentServer.port, 10)
        serverInformation.listening = 0
        serverInformation.responding = 0
        currentServer.currentInfo = serverInformation
        if (currentServer.conn) return requestData(currentServer, currentServer.conn)
        console.log('NET Connect Params', {
            host: currentServer.server,
            port: parseInt(currentServer.port, 10),
            protocol: currentServer.protocol
        })
        const conn = net.connect({
            host: currentServer.server,
            port: parseInt(currentServer.port, 10),
            protocol: currentServer.protocol
        }, err => {
            if (err) {
                engine.log('connection error', err)
                return currentServer.conn = null
            }
            conn.on('error', err => {
                console.log('error conn', err)
                currentServer.conn = null
                conn.close()
            })
            conn.on('close', () => {
                currentServer.conn = null
            })
            conn.on('data', data => {
                onData(currentServer, conn, data)
            })
            requestData(currentServer, conn)
        })
        currentServer.conn = conn
    }

    function requestHTTPData(currentServer) {
        let appendix = ''
        if (currentServer.query === 'terraria') appendix = '/v2/server/status'
		if (currentServer.query === 'eco') appendix = '/info'
        http.simpleRequest({
            'method': 'GET',
            'url': `http://${currentServer.server}:${currentServer.port}${appendix}`,
            'timeout': 6000,
            'headers': [{'Content-Type': 'application/json'}]
        }, (error, response) => {
            if (typeof response !== 'undefined' && response.statusCode === 200) {
                const serverInformation = JSON.parse(response.data.toString())
                if (typeof serverInformation === 'undefined') {
                    engine.log(`ERROR: invalid response: ${response.data}`)
                } else {
                    if (typeof serverInformation.error === 'undefined') engine.log(`API Error: ${serverInformation.error}`)
                    currentServer.currentInfo.status = 1
                    for (const key in serverInformation) {
                        if (key in GSKeys) {
							if (typeof currentServer.currentInfo[GSKeys[key]] === 'undefined'){
								currentServer.currentInfo[GSKeys[key]] = serverInformation[key]
							} else {
                            currentServer.currentInfo[GSKeys[key]] = currentServer.currentInfo[GSKeys[key]] + '\n' + serverInformation[key]
							}
                        } else {
							if (typeof currentServer.currentInfo[key] === 'undefined'){
								currentServer.currentInfo[key] = serverInformation[key]
							} else {
                            currentServer.currentInfo[key] = currentServer.currentInfo[key] + '\n' + serverInformation[key]
							}
                        }
                    }
                }
            }
            writeData(currentServer, '')
        })
    }

    function requestData(currentServer, conn) {
        if (currentServer.query === 'source') {
            conn.write('ffffffff54536f7572636520456e67696e6520517565727900', 'hex')
        }
        if (currentServer.query === 'gamespy4') {
            conn.write('fefd0901020304', 'hex')
        }
        if (currentServer.query === 'gamespy3') {
            conn.write('fefd0910203040', 'hex')
        }
        if (currentServer.query === 'gamespy') {
            conn.write('5c7374617475735c', 'hex')
        }
        if (currentServer.query === 'battlefield2') {
            conn.write('fefd0010203040ffffff01', 'hex')
        }
        if (currentServer.query === 'battlefield3') {
            conn.write(`000000211b000000010000000a000000${stringToHex('serverInfo')}00`, 'hex')
        }
        if (currentServer.query === 'FiveM') {
            conn.write(`ffffffff${stringToHex('getinfo xxx')}`, 'hex')
        }
		if (currentServer.query === 'ase') {
            conn.write(`${stringToHex('s')}`, 'hex')
        }
        setTimeout(() => writeData(currentServer, conn), 10000)
    }

    function onData(currentServer, conn, data) {
        if (currentServer.query === 'source') {
            onSourceData(currentServer, currentServer.currentInfo, data)
        }
        if (currentServer.query === 'gamespy4') {
            onGamespy4Data(currentServer, currentServer.currentInfo, conn, data)
        }
        if (currentServer.query === 'gamespy3') {
            onGamespy3Data(currentServer, currentServer.currentInfo, conn, data)
        }
        if (currentServer.query === 'gamespy') {
            onGamespyData(currentServer, currentServer.currentInfo, conn, data)
        }
        if (currentServer.query === 'battlefield2') {
            onBattlefield2Data(currentServer, currentServer.currentInfo, conn, data)
        }
        if (currentServer.query === 'battlefield3') {
            onBattlefield3Data(currentServer, currentServer.currentInfo, conn, data)
        }
        if (currentServer.query === 'FiveM') {
            onFiveMData(currentServer, currentServer.currentInfo, conn, data)
        }
	if (currentServer.query === 'ase') {
            onASEData(currentServer, currentServer.currentInfo, conn, data)
        }
    }

    function onBattlefield2Data(currentServer, serverInformation, conn, data) {
        /*  K,V List starting at 14th Byte */
        data = data.toString()
        const packetArray = data.substr(14).split('\x00')
        convertPacketToInfo(packetArray, serverInformation)
        serverInformation.status = 1
    }
	
    function read_next_ASE(data) {
        const length = data[0]
        const content = bytesToString(data.slice(1, length))
        data = data.slice(length)
        return [content , data]
    }

    function onASEData(currentServer, serverInformation, conn, data) {
        /*
        Starts with EYE1, following a series of pascal formatted strings (first byte is length, following the content).
        Order of the Values is: ['Game', 'Port', 'Name', 'Gametype', 'Map', 'Version', 'Password',  'Players', 'Max Players']
        */
        data = data.bytes().bytes()
        data = data.slice(4)
        result = read_next_ASE(data)
        serverInformation.game = result[0]
        data = result[1]
        result = read_next_ASE(data)
        serverInformation.port = result[0]
        data = result[1]
        result = read_next_ASE(data)
        serverInformation.name = result[0]
        data = result[1]
        result = read_next_ASE(data)
        serverInformation.description = result[0]
        data = result[1]
        result = read_next_ASE(data)
        serverInformation.map = result[0]
        data = result[1]
        result = read_next_ASE(data)
        serverInformation.version = result[0]
        data = result[1]
        result = read_next_ASE(data)
        serverInformation.password = result[0]
        data = result[1]
        result = read_next_ASE(data)
        serverInformation.players = result[0]
        data = result[1]
        result = read_next_ASE(data)
        serverInformation.playersmax = result[0]
        serverInformation.status = 1
    }

    function onFiveMData(currentServer, serverInformation, conn, data) {
        /*
          K,V List starting at 18th Byte
        */
        data = data.toString()
        const packetArray = data.substr(18).split('\\')
        convertPacketToInfo(packetArray, serverInformation)
        serverInformation.status = 1
    }

    function onBattlefield3Data(currentServer, serverInformation, conn, data) {
        /*
          BytePacket is Header+Body
          Header ends with 'OK'
          Body has pattern
          0<lenght>000<variable>
          for each variable
        */
        const battlefield3Maps = {
            MP_001: 'Grand Bazaar',
            MP_003: 'Theran Highway',
            MP_007: 'Caspian Border',
            MP_011: 'Seine Crossing',
            MP_012: 'Operation Firestorm',
            MP_013: 'Damavand Peak',
            MP_017: 'Noshahr Canals',
            MP_018: 'Kharg Island',
            MP_Subway: 'Operation Metro',
            XP1_001: 'Strike at Karkand',
            XP1_002: 'Gulf of Oman',
            XP1_003: 'Sharqi Peninsula',
            XP1_004: 'Wake Island',
            XP2_Factory: 'Scrapmetal',
            XP2_Office: 'Operation 925',
            XP2_Palace: 'Donya Fortress',
            XP2_Skybar: 'Ziba Tower',
            XP3_Desert: 'Bandar Desert',
            XP3_Alborz: 'Alborz Mountains',
            XP3_Shield: 'Armored Shield',
            XP3_Valley: 'Death Valley',
            XP4_FD: 'Markaz Monolith',
            XP4_Parl: 'Azaid Palace',
            XP4_Quake: 'Epicenter',
            XP4_Rubble: 'Talah Market',
            XP5_001: 'Operation Riverside',
            XP5_002: 'Nebandan Flats',
            XP5_003: 'Kiasar Railroad',
            XP5_004: 'Sabalan Pipelins'
        }
        const battlefield3Gamemodes = {
            ConquestLarge0: 'Conquest Large',
            ConquestSmall0: 'Conquest',
            ConquestAssaultSmall0: 'Conquest Assault',
            RushLarge0: 'Rush',
            SquadRush0: 'Squad Rush',
            SquadDeathMatch0: 'Squad Deathmatch',
            TeamDeathMatch0: 'Team Deathmatch',
            TeamDeathMatchC0: 'TDM Close Quarters',
            Domination0: 'Conquest Domination',
            GunMaster0: 'Gun Master',
            ConquestAssaultLarge0: 'Conquest Assault Large',
            TankSuperiority0: 'Tank Superiority',
            Scavenger0: 'Scavenger',
            CaptureTheFlag0: 'Capture The Flag',
            AirSuperiority0: 'Air Superiority'
        }
        serverInformation.listening = 1
        serverInformation.responding = 1
        data = data.bytes().bytes()
        let prev = 0
        let found = false
        for (let i = 0; i<data.length; i++) {
            if ((prev === 79) && (data[i] === 75)) {
                data = data.slice(i+1)
                found = true
                break
            }
            prev = data[i]
        }
        if (!found) return
        serverInformation.status = 1
        const variables = []
        do {
            if (data.length < 4) break
            const length = data[1]
            variables.push(bytesToString(data.slice(5, 5+length)))
        } while ((data = data.slice(5+length)).length !== 0)
        serverInformation.name = variables[0]
        if (variables[4] in battlefield3Maps) {
            serverInformation.map = battlefield3Maps[variables[4]]
        } else {
            serverInformation.map = variables[4]
        }
        serverInformation.game = 'Battlefield 3'
        if (variables[3] in battlefield3Gamemodes) {
            serverInformation.description = battlefield3Gamemodes[variables[3]]
        } else {
            serverInformation.description = variables[3]
        }
        serverInformation.players = variables[1]
        serverInformation.playersmax = variables[2]
        serverInformation.version = variables[18]
    }

    function onGamespy4Data(currentServer, serverInformation, conn, data) {
        /*
            K,V List starting at 11th Byte - sperated by x00
        */
        if (serverInformation.challenge) {
            data = data.toString()
            const packetArray = data.substr(11).split('\x00')
            convertPacketToInfo(packetArray, serverInformation)
            serverInformation.status = 1
        } else {
            serverInformation.listening = 1
            serverInformation.responding = 1
            data = data.toString().substr(5)
            data = data.replace('\x00', '')
            serverInformation.challenge = dec2hex(data, null)
            const request = `fefd0001020304${serverInformation.challenge}00000000`
            conn.write(request, 'hex')
        }
    }

    function onGamespy3Data(currentServer, serverInformation, conn, data) {
        /*
            K,V List starting at 16th Byte - sperated by x00
        */
        if (serverInformation.challenge) {
            data = data.toString()
            const packetArray = data.substr(16).split('\x00')
            convertPacketToInfo(packetArray, serverInformation)
            serverInformation.status = 1
        } else {
            serverInformation.listening = 1
            serverInformation.responding = 1
            data = data.toString().substr(5)
            data = data.replace('\x00', '')
            serverInformation.challenge = dec2hex(data, null)
            const request = `fefd0010203040${serverInformation.challenge}ffffff01`
            conn.write(request, 'hex')
        }
    }

    function onGamespyData(currentServer, serverInformation, conn, data) {
        /*
            K,V List starting at 1th Byte - sperated by x5c
        */
        data = data.toString()
        const packetArray = data.substr(1).split('\x5c')
        convertPacketToInfo(packetArray, serverInformation)
        serverInformation.status = 1
    }

    function convertPacketToInfo(packetArray, serverInformation) {
        const packetDict = arrayToDict(packetArray)
        for (const key in packetDict) {
            if (key in GSKeys) {
                serverInformation[GSKeys[key]] = packetDict[key]
            } else {
                serverInformation[key] = packetDict[key]
            }
        }
    }

    function arrayToDict(dataArray) {
        const dataDict = {}
        let lastIndex = ''
        for (let t = 0; t < dataArray.length; t++) {
            if (isEven(t)) {
                lastIndex = dataArray[t]
            } else {
                dataDict[lastIndex] = dataArray[t]
            }
        }
        return dataDict
    }

    function bytesToString(bytes) {
        let result = ''
        for (let i = 0; i < bytes.length; i++) {
            result += String.fromCharCode(bytes[i])
        }
        return result
    }

    function dec2hex(str, order) {
        if (!order) order = 'bigEndian'
        let result = parseInt(str, 10).toString(16)
        while (result.length < 8) {
            result = `0${result}`
        }
        if (order !== 'bigEndian') {
            result = result.match(/.{1,2}/g).reverse().join('')
        }
        return result
    }

    function stringToHex(text) {
        let result = ''
        for (let t = 0; t < text.length; t++) {
            result = `${result}${text.charCodeAt(t, 10).toString(16)}`
        }
        return result
    }

    function isEven(n) {
        return n % 2 === 0
    }

    function onSourceData(currentServer, serverInformation, data) {
        serverInformation.listening = 1
        serverInformation.responding = 1
        data = data.toString()
        const response_type = data.substr(4, 1)
        if (response_type !== 'I') return
        const packetArray = data.substr(6).split('\x00')
        serverInformation.name = packetArray[0]
        serverInformation.map = packetArray[1]
        serverInformation.game = packetArray[2]
        serverInformation.description = packetArray[3]
        data = packetArray.slice(4).join('\x00')
        serverInformation.players = data.substr(2, 1).charCodeAt(0)
        serverInformation.playersmax = data.substr(3, 1).charCodeAt(0)
        serverInformation.bots = data.substr(4, 1).charCodeAt(0)
        serverInformation.status = 1
        serverInformation.dedicated = data.substr(5, 1)
        serverInformation.os = data.substr(6, 1)
        serverInformation.password = data.substr(7, 1).charCodeAt(0)
        serverInformation.vac = data.substr(8, 1).charCodeAt(0)
        const matches = data.substr(9).match(/[0-9a-z.]+/)
        serverInformation.version = matches[0]
    }

    // eslint-disable-next-line no-unused-vars
    function writeData(currentServer, conn) {
        const serverInformation = currentServer.currentInfo
        let lastInformation = store.get(`${currentServer.server}:${currentServer.port}`)
        if (!lastInformation) {
            lastInformation = {}
            lastInformation.lastName = ''
            lastInformation.lastDescription = ''
        }
        const channel = backend.getChannelByID(currentServer.channel)
        if (channel) {
            if (currentServer.channelName) {
                const channelName = replacePlaceholders(currentServer.channelName, serverInformation)
                if (lastInformation.lastName !== channelName) {
                    channel.setName(channelName)
                    lastInformation.lastName = channelName
                }
            }
            if (currentServer.channelDescription) {
                const channelDescription = replacePlaceholders(currentServer.channelDescription, serverInformation)
                if (lastInformation.lastDescription !== channelDescription) {
                    /*var currentChannelDescription = channel.description()
                    if (currentChannelDescription.indexOf('<ServerQuery>') != -1){
                      channel.setDescription(currentChannelDescription.replace(/<ServerQuery>.*<\/ServerQuery>/, '<ServerQuery>\n'+channelDescription+'</ServerQuery>\n'))
                    }else{*/
                    // eslint-disable-next-line indent
                    channel.setDescription(channelDescription)
                    //}
                    lastInformation.lastDescription = channelDescription
                }
            }
        }
        store.set(`${currentServer.server}:${currentServer.port}`, lastInformation)
    }

    function replacePlaceholders(str, server) {
        // online
        if (server.status) {
            str = str.replace(/%s/g, 'Online')
            str = str.replace(/%g/g, server.game)
            str = str.replace(/%m/g, server.map)
            str = str.replace(/%v/g, server.version)
            str = str.replace(/%n/g, server.name)
            str = str.replace(/%pmax/g, server.playersmax)
            str = str.replace(/%p/g, server.players)
            str = str.replace(/%b/g, server.bots)
            str = str.replace(/%d/g, server.description)
            // offline or error
        } else {
            str = str.replace(/%s/g, 'Offline')
            str = str.replace(/%g/g, '')
            str = str.replace(/%m/g, '')
            str = str.replace(/%v/g, '')
            str = str.replace(/%n/g, '')
            str = str.replace(/%pmax/g, '0')
            str = str.replace(/%p/g, '0')
            str = str.replace(/%b/g, '0')
            str = str.replace(/%d/g, '')
        }
        return str
    }
})
