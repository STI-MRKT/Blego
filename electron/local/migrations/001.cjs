module.exports=db=>db.exec(`
 CREATE TABLE kv(key TEXT PRIMARY KEY, value TEXT NOT NULL);
 CREATE TABLE issued(field TEXT NOT NULL, scope TEXT NOT NULL, value TEXT NOT NULL, profile_id TEXT NOT NULL, PRIMARY KEY(field,scope,value));
 CREATE TABLE requests(request_id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, profile TEXT NOT NULL);
 CREATE TABLE rule_versions(version TEXT PRIMARY KEY, configuration TEXT NOT NULL);
 CREATE TABLE archives(id TEXT PRIMARY KEY, operation_id TEXT UNIQUE NOT NULL, file_name TEXT UNIQUE NOT NULL, state TEXT NOT NULL, metadata TEXT NOT NULL);
 CREATE TABLE news(source_id TEXT PRIMARY KEY, snapshot TEXT NOT NULL);
`);
