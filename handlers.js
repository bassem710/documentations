const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/ApiError");
const ApiFeatures = require("../utils/ApiFeatures");
const capitalizeFirstLetter = require("../utils/capitalizeFirstLetter");
const splitCamelCase = require("../utils/splitCamelCase");
const translate = require("../utils/translate");

exports.deleteOne = ({ model, message }) =>
  asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const lang = req.headers.lang?.toLowerCase() === "ar" ? "ar" : "en";
    const document = await model.findById(id);
    if (!document)
      return next(
        new ApiError(
          `${capitalizeFirstLetter(
            splitCamelCase(model.modelName).toLowerCase()
          )} not found`,
          404
        )
      );
    await document.deleteOne();
    res.status(200).json({
      success: true,
      message:
        translate(message, lang) ||
        translate(
          `${capitalizeFirstLetter(
            splitCamelCase(model.modelName).toLowerCase()
          )} deleted successfully`,
          lang
        )
    });
  });

exports.updateOne = ({
  model,
  langFields,
  selectStr = "",
  message,
  returnData = true
}) =>
  asyncHandler(async (req, res, next) => {
    // Handle language
    let lang = "En";
    switch (req.headers.lang?.toLowerCase()) {
      case "ar":
        lang = "Ar";
        break;
      case "all":
        lang = "all";
        break;
      default:
        break;
    }
    req.headers.lang = "all";
    // Find the document
    const document = await model.findById(req.params.id).select(selectStr);
    if (!document) {
      return next(
        new ApiError(
          `${capitalizeFirstLetter(
            splitCamelCase(model.modelName).toLowerCase()
          )} not found`,
          404
        )
      );
    }
    // Update fields manually
    Object.assign(document, req.body);
    document.lang = lang;
    // Save the updated document
    let saved = await document.save();
    let localizedData;
    if (returnData) {
      saved = saved.toJSON();
      localizedData = { ...saved };
      langFields?.forEach((field) => {
        localizedData[field] = saved[`${field}${lang}`];
      });
    }
    // Send response
    res.status(200).json({
      success: true,
      message:
        translate(message, lang) ||
        translate(
          `${capitalizeFirstLetter(
            splitCamelCase(model.modelName).toLowerCase()
          )} updated successfully`,
          lang
        ),
      data: localizedData
    });
  });

exports.createOne = ({
  model,
  langFields,
  selectStr = "",
  message,
  returnData = true
}) =>
  asyncHandler(async (req, res) => {
    // Determine the language
    let lang = "En";
    switch (req.headers.lang?.toLowerCase()) {
      case "ar":
        lang = "Ar";
        break;
      case "all":
        lang = "all";
        break;
      default:
        break;
    }
    req.headers.lang = "all";
    // Create the new document
    const mongooseQuery = model.create(req.body);
    mongooseQuery.lang = lang;
    let saved = await mongooseQuery;
    // Apply selectStr
    let filteredData;
    if (returnData) {
      saved = saved.toJSON();
      // Handle localization
      const localizedData = { ...saved };
      langFields?.forEach((field) => {
        localizedData[field] = saved[`${field}${lang}`];
      });
      // Apply selectStr to filter the response data
      const fieldsToInclude = selectStr ? selectStr.split(" ") : [];
      filteredData = fieldsToInclude.length
        ? Object.fromEntries(
            Object.entries(localizedData).filter(([key]) =>
              fieldsToInclude.includes(key)
            )
          )
        : localizedData;
    }
    // Response
    res.status(201).json({
      success: true,
      message:
        translate(message, lang) ||
        translate(
          `${capitalizeFirstLetter(
            splitCamelCase(model.modelName).toLowerCase()
          )} created successfully`,
          lang
        ),
      data: filteredData
    });
  });

exports.getOne = ({ model, langFields, selectStr = "", populationOpt }) =>
  asyncHandler(async (req, res, next) => {
    // lang
    let lang = "en";
    switch (req.headers.lang?.toLowerCase()) {
      case "ar":
        lang = "ar";
        break;
      case "all":
        lang = "all";
        break;
      default:
        break;
    }
    // Query
    let query = model.findById(req.params.id).select(selectStr);
    // Population
    if (populationOpt) query = query.populate(populationOpt);
    // Pass request lang to query
    query.lang = lang;
    // Api Features
    const apiFeatures = new ApiFeatures(query, req.query)
      .limitFields(lang, langFields)
      .mongooseQueryExec();
    // Execute the query
    let doc = await apiFeatures.mongooseQuery;
    if (!doc[0] || doc.length === 0)
      return next(
        new ApiError(
          `${capitalizeFirstLetter(
            splitCamelCase(model.modelName).toLowerCase()
          )} not found`,
          404
        )
      );
    // Check if the item exists
    doc = doc[0].toJSON();
    // Response
    res.status(200).json({
      success: true,
      data: doc
    });
  });

exports.getAll = ({
  model,
  langFields,
  selectStr = "",
  sort,
  populationOpt,
  options
}) =>
  asyncHandler(async (req, res) => {
    // lang
    let lang = "en";
    switch (req.headers.lang?.toLowerCase()) {
      case "ar":
        lang = "ar";
        break;
      case "all":
        lang = "all";
        break;
      default:
        break;
    }
    // Filter Object
    let filter = {};
    if (req.filterObj) filter = req.filterObj;
    // Fields
    req.query.fields = selectStr || req.query.fields;
    req.query.sort = sort || req.query.sort;
    // ApiFeatures instance
    const mongoQuery = model.find(filter, {}, options);
    mongoQuery.lang = lang;
    // Population
    if (populationOpt) {
      if (populationOpt.langFields)
        mongoQuery.populate({
          ...populationOpt,
          select: `${populationOpt.select} ${
            (populationOpt,
            langFields
              .map((one) =>
                lang === "all"
                  ? `${one}En ${one}Ar`
                  : `${one}${capitalizeFirstLetter(lang)}`
              )
              .join(" "))
          }`
        });
      else mongoQuery.populate(populationOpt);
    }
    const apiFeatures = new ApiFeatures(mongoQuery, req.query)
      .filter()
      .search(model.modelName)
      .sort(lang, langFields)
      .limitFields(lang, langFields);
    // Clone apiFeatures to get documents count after filterations
    const clonedApiFeatures = apiFeatures.clone().mongooseQueryExec();
    const docsCount = await clonedApiFeatures.mongooseQuery.countDocuments();
    // Paginate filtered documents
    apiFeatures.pagination(docsCount).mongooseQueryExec();
    // Fetch data
    const { mongooseQuery, paginationResult } = apiFeatures;
    let docs = await mongooseQuery;
    // Response
    res.status(200).json({
      success: true,
      pagination: paginationResult,
      data: docs
    });
  });
