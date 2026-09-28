using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Samhallsinformation.Migrations
{
    /// <inheritdoc />
    public partial class AddEventsUniqueIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_Events_SourceId",
                table: "Events",
                column: "SourceId");

            migrationBuilder.CreateIndex(
                name: "IX_Events_SourceId_ExternalId",
                table: "Events",
                columns: new[] { "SourceId", "ExternalId" },
                unique: true,
                filter: "\"ExternalId\" IS NOT NULL AND \"ExternalId\" <> ''");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Events_SourceId",
                table: "Events");

            migrationBuilder.DropIndex(
                name: "IX_Events_SourceId_ExternalId",
                table: "Events");
        }
    }
}
