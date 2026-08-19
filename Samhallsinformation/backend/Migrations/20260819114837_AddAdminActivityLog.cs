using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Samhallsinformation.Migrations
{
    /// <inheritdoc />
    public partial class AddAdminActivityLog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AdminActivityLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Tid = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Vem = table.Column<string>(type: "TEXT", nullable: false),
                    Typ = table.Column<string>(type: "TEXT", nullable: false),
                    Rubrik = table.Column<string>(type: "TEXT", nullable: false),
                    Detalj = table.Column<string>(type: "TEXT", nullable: false),
                    Ångrad = table.Column<bool>(type: "INTEGER", nullable: false),
                    AngraAnvandareId = table.Column<string>(type: "TEXT", nullable: true),
                    AngraEventId = table.Column<string>(type: "TEXT", nullable: true),
                    AngraTitle = table.Column<string>(type: "TEXT", nullable: true),
                    AngraSourceName = table.Column<string>(type: "TEXT", nullable: true),
                    AngraPublishedAt = table.Column<string>(type: "TEXT", nullable: true),
                    AngraSparadDatum = table.Column<string>(type: "TEXT", nullable: true),
                    AngraUndoAction = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AdminActivityLogs", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AdminActivityLogs_Tid",
                table: "AdminActivityLogs",
                column: "Tid");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AdminActivityLogs");
        }
    }
}
