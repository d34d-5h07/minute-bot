const { Client, GatewayIntentBits } = require('discord.js');
const {
  joinVoiceChannel,
  entersState,
  VoiceConnectionStatus,
  createAudioReceiver,
} = require('@discordjs/voice');
const fs = require('fs');
const prism = require('prism-media');
const ffmpeg = require('fluent-ffmpeg');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Ensure recordings directory exists
const recordingsPath = './recordings';
if (!fs.existsSync(recordingsPath)) {
  fs.mkdirSync(recordingsPath);
}

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', async (message) => {
  if (message.content === '!record') {
    if (!message.member.voice.channel) {
      return message.reply('You need to be in a voice channel to use this command.');
    }

    const voiceChannel = message.member.voice.channel;
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    });

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 20e3);
      const receiver = connection.receiver;

      receiver.speaking.on('start', (userId) => {
        console.log(`Started recording user ${userId}.`);
        const audioStream = receiver.subscribe(userId, {
          end: {
            behavior: 'silence',
            duration: 100,
          },
        });
        const pcmPath = `${recordingsPath}/${userId}-${Date.now()}.pcm`;
        const outputStream = fs.createWriteStream(pcmPath);
        const opusDecoder = new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 });
        audioStream.pipe(opusDecoder).pipe(outputStream);

        opusDecoder.on('end', () => {
          console.log(`Finished recording user ${userId}.`);
          const mp3Path = pcmPath.replace('.pcm', '.mp3');
          ffmpeg(pcmPath)
            .inputFormat('s16le')
            .audioFrequency(48000)
            .audioChannels(2)
            .audioCodec('libmp3lame')
            .on('error', (err) => console.error(err))
            .on('end', () => {
              message.channel.send({
                content: 'Here is your recording:',
                files: [mp3Path],
              }).then(() => {
                fs.unlinkSync(pcmPath); // Optionally delete the PCM file
              });
            })
            .save(mp3Path);
        });
      });
``
      message.reply('Recording started. Speak now!');
    } catch (err) {
      console.error(err);
      message.reply('Failed to join the voice channel.');
      if (connection) connection.destroy();
    }
  }
});

client.login('TOKEN');
