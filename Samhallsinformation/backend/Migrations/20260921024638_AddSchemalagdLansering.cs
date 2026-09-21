using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Samhallsinformation.Migrations
{
    /// <inheritdoc />
    public partial class AddSchemalagdLansering : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "SchemalagdPubliceringUtc",
                table: "Uppdateringar",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SchemalagdaFlaggorJson",
                table: "Uppdateringar",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "RedoAttLanseras",
                table: "FeatureFlagOverrides",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SchemalagdPubliceringUtc",
                table: "Uppdateringar");

            migrationBuilder.DropColumn(
                name: "SchemalagdaFlaggorJson",
                table: "Uppdateringar");

            migrationBuilder.DropColumn(
                name: "RedoAttLanseras",
                table: "FeatureFlagOverrides");
        }
    }
}
