#!/usr/bin/env node

/**
 * Hello World 25
 * A simple Hello World program
 */

function main() {
    console.log("Hello, World!");
    console.log("Welcome to Hello World 25!");
}

// Run the program
if (require.main === module) {
    main();
}

module.exports = { main };
