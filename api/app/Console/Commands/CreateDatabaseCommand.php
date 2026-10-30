<?php
/**
 * @file CreateDatabaseCommand.php
 * @path app/Console/Commands/CreateDatabaseCommand.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026-10-30
 * @description Creates the database of the configured connection when it does not exist yet
 *   (`CREATE DATABASE … utf8mb4_unicode_ci`), so a fresh installation needs no phpMyAdmin step:
 *   `php artisan db:create-if-missing && php artisan migrate && php artisan db:seed`.
 *   Used by init-workspace.sh (local XAMPP) and deploy/server/configure-server.sh (server).
 *   An existing database is never touched (no drop, no change of its collation).
 * @note It connects to the database SERVER without selecting a database (Laravel itself
 *   cannot connect before the database exists). Only MySQL / MariaDB connections are handled;
 *   other drivers (SQLite of the tests) have nothing to create. On shared hosting the database
 *   account usually may not create databases - then create the empty database in the hosting
 *   panel; the command reports that and exits with an error code.
 * @security The database name is validated against [A-Za-z0-9_] (it cannot be bound as a
 *   parameter in CREATE DATABASE); the password is never printed.
 * @dependencies
 * - config/database.php (connection settings from .env), PDO (pdo_mysql).
 */

namespace App\Console\Commands;

use Illuminate\Console\Command;
use PDO;
use PDOException;

class CreateDatabaseCommand extends Command
{
    /** @var string */
    protected $signature = 'db:create-if-missing {--connection= : Database connection (default: the default connection)}';

    /** @var string */
    protected $description = 'Creates the database of the connection (utf8mb4_unicode_ci) when it does not exist yet.';

    /** Allowed database name: letters, digits, underscore (MySQL limit 64 characters). */
    private const NAME_PATTERN = '/^[A-Za-z0-9_]{1,64}$/';

    /**
     * @description Checks the database and creates it when missing.
     * @return int 0 = exists or created (or nothing to create); 1 = invalid settings / no connection / no privilege.
     */
    public function handle(): int
    {
        $connection = (string) ($this->option('connection') ?: config('database.default'));
        $config = config("database.connections.{$connection}");
        if (!is_array($config)) {
            $this->error("Unknown database connection: {$connection}");
            return self::FAILURE;
        }
        if (!in_array($config['driver'] ?? '', ['mysql', 'mariadb'], true)) {
            $this->info("Connection {$connection} uses the driver '" . ($config['driver'] ?? '?') . "' - nothing to create.");
            return self::SUCCESS;
        }

        $database = (string) ($config['database'] ?? '');
        if (!preg_match(self::NAME_PATTERN, $database)) {
            $this->error("Invalid database name '{$database}' (DB_DATABASE) - use letters, digits and _ only.");
            return self::FAILURE;
        }

        try {
            $pdo = $this->connectToServer($config);
        } catch (PDOException $e) {
            $this->error('Cannot connect to the database server: ' . $e->getMessage());
            return self::FAILURE;
        }

        $exists = $pdo->prepare('SELECT 1 FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?');
        $exists->execute([$database]);
        if ($exists->fetchColumn() !== false) {
            $this->info("Database {$database} already exists - left unchanged.");
            return self::SUCCESS;
        }

        try {
            $pdo->exec("CREATE DATABASE `{$database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        } catch (PDOException $e) {
            $this->error("Database {$database} could not be created: " . $e->getMessage());
            $this->line('On shared hosting create the empty database in the hosting panel, then run the migrations.');
            return self::FAILURE;
        }

        $this->info("Database {$database} created (utf8mb4_unicode_ci).");
        return self::SUCCESS;
    }

    /**
     * @description Opens a connection to the server of the configured connection, without a database.
     * @param array<string, mixed> $config Connection settings (config/database.php).
     * @return PDO
     * @throws PDOException When the server cannot be reached or the credentials are wrong.
     */
    protected function connectToServer(array $config): PDO
    {
        $dsn = !empty($config['unix_socket'])
            ? "mysql:unix_socket={$config['unix_socket']};charset=utf8mb4"
            : 'mysql:host=' . ($config['host'] ?? '127.0.0.1') . ';port=' . ($config['port'] ?? 3306) . ';charset=utf8mb4';

        return new PDO($dsn, (string) ($config['username'] ?? ''), (string) ($config['password'] ?? ''), [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_TIMEOUT => 10,
        ]);
    }
}
