# Security Specification for Firestore Rules

## 1. Data Invariants
1. Products can be read by anyone (public catalog).
2. Products can only be created/updated/deleted by authorized administrators.
3. Inquiries can be created by anyone, but not modified or deleted by users.

## 2. The "Dirty Dozen" Payloads (Examples to block)
1. Creating a product without an ID.
2. Creating a product with a massive ID (>128 chars).
3. Updating a product's price to a negative number.
4. Updating a product's title to be an object instead of a string.
5. Deleting a product without admin authentication (if auth implemented).
6. Creating an inquiry with a missing productId.
7. Updating an existing inquiry.
8. Deleting an inquiry.
9. Injecting a "ghost field" (e.g., `isAdmin: true`) into a product document.
10. Creating a product with a missing required title.
11. Updating a product's createdAt timestamp.
12. Attempting to write to a path outside `products` or `inquiries`.
