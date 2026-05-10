# Assets

**images/** — Shared graphics (avatar, logo, diagrams reused across multiple posts).

From a project file `projects/my-story/post.md`, reference a shared asset like this:

```markdown
![Logo](../../assets/images/logo.png)
```

Adjust `../` segments if you rename folders—goal is a correct relative path from the Markdown file to the image file.
