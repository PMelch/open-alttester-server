const port = parseInt(process.env.ALTSERVER_PORT ?? "13000");

console.log(`AltTester Server starting on port ${port}…`);

// Server implementation wired in TASK-1.3
export { port };
