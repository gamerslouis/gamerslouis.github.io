import os
import re
import hashlib
import shutil
import sys

def md5_hash(file_path):
    """Generate MD5 hash for a file."""
    with open(file_path, "rb") as f:
        return hashlib.md5(f.read()).hexdigest()

def process_markdown(md_file):
    """Process the Markdown file to move and rename images."""
    static_img_dir = os.path.join("static", "img", "pages")
    os.makedirs(static_img_dir, exist_ok=True)

    md_dir = os.path.dirname(md_file)
    with open(md_file, "r", encoding="utf-8") as f:
        content = f.read()

    # Regex to find image references in Markdown
    image_pattern = re.compile(r"!\[.*?\]\((.+?)\)")
    matches = image_pattern.findall(content)

    for match in matches:
        image_path = os.path.join(md_dir, match)
        if os.path.isfile(image_path):
            # Generate MD5 hash and new file name
            hash_name = md5_hash(image_path)
            new_file_name = f"{hash_name}.png"
            new_file_path = os.path.join(static_img_dir, new_file_name)

            # Move and rename the image
            shutil.move(image_path, new_file_path)

            # Update the Markdown content
            new_image_path = f"/img/pages/{new_file_name}"
            content = content.replace(match, new_image_path)

    # Remove alt text from image references
    content = re.sub(r"!\[alt text\]\((.+?)\)", r"![](\1)", content)

    # Write the updated content back to the Markdown file
    with open(md_file, "w", encoding="utf-8") as f:
        f.write(content)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python move_images.py <markdown_file>")
        sys.exit(1)




    markdown_file = sys.argv[1]
    if not os.path.isfile(markdown_file):
        print(f"Error: File '{markdown_file}' does not exist.")
        sys.exit(1)

    # move to the directory of the script
    markdown_file = os.path.abspath(markdown_file)
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    process_markdown(markdown_file)
    print("Processing complete.")
