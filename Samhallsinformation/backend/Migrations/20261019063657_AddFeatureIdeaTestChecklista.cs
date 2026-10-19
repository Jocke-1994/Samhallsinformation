using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Samhallsinformation.Migrations
{
    /// <inheritdoc />
    public partial class AddFeatureIdeaTestChecklista : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Fas",
                table: "FeatureIdeaChecklistItems",
                type: "TEXT",
                nullable: false,
                defaultValue: "lansering");

            migrationBuilder.CreateTable(
                name: "FeatureIdeaTestFiles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    FeatureIdeaId = table.Column<Guid>(type: "TEXT", nullable: false),
                    FilePath = table.Column<string>(type: "TEXT", nullable: false),
                    AddedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FeatureIdeaTestFiles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FeatureIdeaTestFiles_FeatureIdeas_FeatureIdeaId",
                        column: x => x.FeatureIdeaId,
                        principalTable: "FeatureIdeas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FeatureIdeaTestFiles_FeatureIdeaId",
                table: "FeatureIdeaTestFiles",
                column: "FeatureIdeaId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FeatureIdeaTestFiles");

            migrationBuilder.DropColumn(
                name: "Fas",
                table: "FeatureIdeaChecklistItems");
        }
    }
}
