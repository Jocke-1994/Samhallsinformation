using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Samhallsinformation.Migrations
{
    /// <inheritdoc />
    public partial class AddUppdateringar : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Uppdateringar",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Titel = table.Column<string>(type: "TEXT", nullable: false),
                    Datum = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Publicerad = table.Column<bool>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Uppdateringar", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "UppdateringsPunkter",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    UppdateringId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Typ = table.Column<string>(type: "TEXT", nullable: false),
                    Plats = table.Column<string>(type: "TEXT", nullable: false),
                    Text = table.Column<string>(type: "TEXT", nullable: false),
                    Synlighet = table.Column<string>(type: "TEXT", nullable: false),
                    Ordning = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UppdateringsPunkter", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UppdateringsPunkter_Uppdateringar_UppdateringId",
                        column: x => x.UppdateringId,
                        principalTable: "Uppdateringar",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UppdateringsPunkter_UppdateringId",
                table: "UppdateringsPunkter",
                column: "UppdateringId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UppdateringsPunkter");

            migrationBuilder.DropTable(
                name: "Uppdateringar");
        }
    }
}
