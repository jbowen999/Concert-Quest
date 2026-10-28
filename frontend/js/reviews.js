// Reviews section of concert.html: list, create, edit, delete.
// (Jerith Gurusubburam)
import { api } from "./api.js";
import { askPasscode } from "./passcode-dialog.js";

const RATING_OPTIONS = [
  [5, "5 – Excellent"],
  [4, "4 – Good"],
  [3, "3 – Average"],
  [2, "2 – Poor"],
  [1, "1 – Terrible"],
];

const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function timeEl(iso) {
  const time = el("time", "", dateFormat.format(new Date(iso)));
  time.dateTime = iso;
  return time;
}

function emptyMessage(text) {
  return el("li", "reviews__empty", text);
}

export function initReviews(concert) {
  const list = document.getElementById("review-list");
  const form = document.getElementById("review-form");
  const formError = form.querySelector(".review-form__error");
  const submitButton = form.querySelector('button[type="submit"]');

  async function load() {
    list.setAttribute("aria-busy", "true");
    list.replaceChildren(emptyMessage("Loading reviews…"));
    try {
      const reviews = await api(
        `/reviews?concertId=${encodeURIComponent(concert._id)}`
      );
      renderList(reviews);
      list.setAttribute("aria-busy", "false");
    } catch (err) {
      list.replaceChildren(
        emptyMessage(`Couldn't load reviews: ${err.message}`)
      );
    }
  }

  function renderList(reviews) {
    if (!reviews.length) {
      list.replaceChildren(
        emptyMessage("No reviews yet. Be the first to leave one.")
      );
      return;
    }
    list.replaceChildren(...reviews.map(makeItem));
  }

  function makeItem(review) {
    const item = el("li", "reviews__item");
    showView(item, review);
    return item;
  }

  function showView(item, review) {
    const meta = el("div", "reviews__meta");
    meta.append(
      el("strong", "", review.reviewerName),
      el("span", "reviews__rating", `${review.rating}/5`),
      timeEl(review.createdAt)
    );

    const comment = el("p", "reviews__comment", review.comment);

    const status = el("p", "reviews__status");
    status.setAttribute("role", "alert");

    const editButton = el("button", "reviews__edit", "Edit");
    editButton.type = "button";
    const deleteButton = el("button", "reviews__delete", "Delete");
    deleteButton.type = "button";

    const actions = el("div", "reviews__actions");
    actions.append(editButton, deleteButton, status);

    item.replaceChildren(meta, comment, actions);

    editButton.addEventListener("click", () => showEditForm(item, review));
    deleteButton.addEventListener("click", () =>
      deleteReview(item, review, status, deleteButton)
    );
  }

  function showEditForm(item, review) {
    const editForm = el("form", "reviews__edit-form");

    const ratingSelect = document.createElement("select");
    ratingSelect.name = "rating";
    ratingSelect.required = true;
    for (const [value, label] of RATING_OPTIONS) {
      const option = document.createElement("option");
      option.value = String(value);
      option.textContent = label;
      option.selected = value === review.rating;
      ratingSelect.append(option);
    }

    const commentField = document.createElement("textarea");
    commentField.name = "comment";
    commentField.required = true;
    commentField.maxLength = 5000;
    commentField.rows = 4;
    commentField.value = review.comment;

    const ratingLabel = el("label", "review-form__field", "Rating");
    ratingLabel.append(ratingSelect);
    const commentLabel = el("label", "review-form__field", "Review");
    commentLabel.append(commentField);

    const error = el("p", "reviews__status");
    error.setAttribute("role", "alert");

    const saveButton = el("button", "", "Save");
    saveButton.type = "submit";
    const cancelButton = el("button", "", "Cancel");
    cancelButton.type = "button";

    const actions = el("div", "reviews__actions");
    actions.append(saveButton, cancelButton);

    editForm.append(ratingLabel, commentLabel, error, actions);
    item.replaceChildren(editForm);

    cancelButton.addEventListener("click", () => showView(item, review));

    editForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      error.textContent = "";
      const passcode = await askPasscode(
        "Save changes to this review? Enter the passcode it was posted with, or the admin passcode."
      );
      if (passcode === null) return;

      saveButton.disabled = true;
      try {
        const updated = await api(
          `/reviews/${encodeURIComponent(review._id)}`,
          {
            method: "PUT",
            body: {
              reviewerName: review.reviewerName,
              rating: Number(ratingSelect.value),
              comment: commentField.value,
              passcode,
            },
          }
        );
        showView(item, updated);
      } catch (err) {
        error.textContent =
          err.status === 403
            ? "That passcode doesn't match this review."
            : `Couldn't save: ${err.message}`;
        saveButton.disabled = false;
      }
    });
  }

  async function deleteReview(item, review, status, button) {
    status.textContent = "";
    const passcode = await askPasscode(
      "Delete this review? Enter the passcode it was posted with, or the admin passcode."
    );
    if (passcode === null) return;

    button.disabled = true;
    try {
      await api(`/reviews/${encodeURIComponent(review._id)}`, {
        method: "DELETE",
        body: { passcode },
      });
      item.remove();
      if (!list.children.length) {
        list.replaceChildren(
          emptyMessage("No reviews yet. Be the first to leave one.")
        );
      }
    } catch (err) {
      status.textContent =
        err.status === 403
          ? "That passcode doesn't match this review."
          : `Couldn't delete the review: ${err.message}`;
      button.disabled = false;
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    formError.textContent = "";
    const data = Object.fromEntries(new FormData(form));

    submitButton.disabled = true;
    try {
      await api("/reviews", {
        method: "POST",
        body: {
          reviewerName: data.reviewerName,
          rating: Number(data.rating),
          comment: data.comment,
          passcode: data.passcode,
          concertId: concert._id,
        },
      });
      form.reset();
      await load();
    } catch (err) {
      formError.textContent = err.message;
    } finally {
      submitButton.disabled = false;
    }
  });

  load();
}
