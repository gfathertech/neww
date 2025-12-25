const numberBot = '447777331420' // number bot
const prefix = ['.'] // prefix bot
const botName = 'Kkzaabot' // bot name
const owner = ['447777331420', '2349136429929'] // owner numbers (without @s.whatsapp.net)
const botMode = 'group' // 'group' or 'private' or 'both'
const usePairing = false // true or false

export const config = {
	botName,
	phone: numberBot,
	prefix,
	owner: owner.map(num => `${num}@s.whatsapp.net`),
	botMode,
	usePairing
}
