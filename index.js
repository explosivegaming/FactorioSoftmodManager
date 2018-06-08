const args = process.argv
switch (args[2]) {
    default:
        require('./src/options/help')()
        break
    case '--help':
    case '-h':
        require('./src/options/help')()
        break
    case '--info':
    case '-i':
        require('./src/options/info')(args[3])
        break
}