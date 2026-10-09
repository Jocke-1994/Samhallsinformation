using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Samhallsinformation.Migrations
{
    /// <inheritdoc />
    public partial class AddUppdateringAnnonsering : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "AnnonseradUtc",
                table: "Uppdateringar",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "AnnonseringUtc",
                table: "Uppdateringar",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PushSkickaVid",
                table: "Uppdateringar",
                type: "TEXT",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AnnonseradUtc",
                table: "Uppdateringar");

            migrationBuilder.DropColumn(
                name: "AnnonseringUtc",
                table: "Uppdateringar");

            migrationBuilder.DropColumn(
                name: "PushSkickaVid",
                table: "Uppdateringar");
        }
    }
}
